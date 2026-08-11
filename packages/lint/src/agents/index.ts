import type { SdxConfig } from "@specdx/schema";
import type { Severity, Diagnostic } from "../types.js";
import type { AgentRule, AgentLintResults } from "./types.js";
import { discoverAgentFiles, DEFAULT_AGENT_PATHS, DEFAULT_MAX_TOKENS } from "./discover.js";
import { structureRule } from "./rules/structure.js";
import { staleReferencesRule } from "./rules/stale-references.js";
import { sizeBudgetRule } from "./rules/size-budget.js";
import { indexProjectFiles, createReferenceResolver } from "./resolve-reference.js";

export type {
  AgentFile,
  AgentRule,
  AgentRuleResult,
  AgentLintContext,
  AgentLintResults,
} from "./types.js";
export { discoverAgentFiles, DEFAULT_AGENT_PATHS, DEFAULT_MAX_TOKENS } from "./discover.js";
export { extractReferences } from "./rules/stale-references.js";
export { indexProjectFiles, createReferenceResolver, isPlaceholder } from "./resolve-reference.js";

/**
 * The agent rule set, in its own namespace.
 *
 * Not merged into the spec presets, and not reachable from `lint.extends`:
 * `strict` must not silently start failing builds over someone's CLAUDE.md
 * (ADR constraint 2). Severity is configured through `agents.rules` only.
 */
export const AGENT_RULES: AgentRule[] = [structureRule, staleReferencesRule, sizeBudgetRule];

const VALID_SEVERITIES = new Set<Severity>(["error", "warn", "info"]);

export class AgentConfigError extends Error {}

/**
 * Apply `agents.rules` overrides.
 *
 * An unknown rule id throws rather than being ignored. A typo that silently
 * configures nothing is the exact shape `lint.rules` shipped in for six
 * audits: it looked configured and did nothing.
 */
export function resolveAgentRules(overrides: Record<string, unknown> = {}): AgentRule[] {
  const known = new Map(AGENT_RULES.map((rule) => [rule.id, rule]));

  for (const id of Object.keys(overrides)) {
    if (!known.has(id)) {
      throw new AgentConfigError(
        `Unknown agent rule "${id}" in agents.rules. Known rules: ${[...known.keys()].join(", ")}.`,
      );
    }
  }

  const resolved: AgentRule[] = [];
  for (const rule of AGENT_RULES) {
    const override = overrides[rule.id];
    if (override === undefined) {
      resolved.push(rule);
      continue;
    }
    if (override === false || override === "off") continue;
    if (typeof override === "string" && VALID_SEVERITIES.has(override as Severity)) {
      resolved.push({ ...rule, severity: override as Severity });
      continue;
    }
    throw new AgentConfigError(
      `Invalid severity ${JSON.stringify(override)} for "${rule.id}". Use "error", "warn", "info", "off", or false.`,
    );
  }
  return resolved;
}

export interface LintAgentFilesOptions {
  config: SdxConfig;
  configDir: string;
  /** Overridable so tests need no fixture tree on disk. */
  exists?: (relativePath: string) => boolean;
}

/**
 * Lint every configured agent instruction file.
 *
 * Returns `assessed: false` when the configured paths matched nothing, so a
 * caller can refuse to call that a pass (ADR constraint 3).
 */
export async function lintAgentFiles(options: LintAgentFilesOptions): Promise<AgentLintResults> {
  const { config, configDir } = options;
  const agents = config.agents ?? {};
  const patterns = agents.paths ?? DEFAULT_AGENT_PATHS;
  const maxTokens = agents.max_tokens ?? DEFAULT_MAX_TOKENS;
  const rules = resolveAgentRules(agents.rules as Record<string, unknown> | undefined);
  const files = await discoverAgentFiles(patterns, configDir);

  // Index the project once per run, and only when there is something to check
  // against it. Walking the tree for a repo with no agent files configured
  // would be pure cost.
  const exists =
    options.exists ??
    (files.length > 0 ? createReferenceResolver(indexProjectFiles(configDir)) : () => true);

  const diagnostics: Diagnostic[] = [];

  for (const file of files) {
    for (const rule of rules) {
      const result = rule.run({ file, configDir, exists, maxTokens });

      // The rule object's severity is the authority, never the severity a rule
      // happened to write into the diagnostic it returned. Same contract the
      // spec engine enforces, for the same reason: it is what makes an
      // override mean anything.
      for (const diagnostic of result.diagnostics) {
        diagnostics.push({ ...diagnostic, severity: rule.severity });
      }

      // A rule that could not judge anything says so, rather than returning an
      // empty array that reads as a pass. Structural, not inferred from a
      // severity string — `assessed: false` is the only way to say it.
      if (result.assessed === false) {
        diagnostics.push({
          ruleId: rule.id,
          severity: "info",
          message:
            result.notAssessedReason ?? `${rule.id} assessed nothing in ${file.relativePath}.`,
          filePath: file.filePath,
        });
      }
    }
  }

  return { diagnostics, filesLinted: files.length, assessed: files.length > 0 };
}

import { isAbsolute, resolve } from "node:path";
import { resolveGlob } from "@specdx/core";
import type { SdxConfig } from "@specdx/schema";
import type { LintRule, Severity } from "./types.js";
import { getPreset } from "./presets.js";
import { allBuiltinRules } from "./rules/index.js";
import { loadCustomRule } from "./custom-rule-loader.js";

const SEVERITIES: ReadonlySet<string> = new Set(["error", "warn", "info"]);

export interface ResolveLintConfigOptions {
  /** The loaded `spec.config.yaml`. */
  config?: SdxConfig;
  /** Explicit preset, from `--preset` / the Action input / `runLint({ preset })`. Beats `lint.extends`. */
  preset?: string;
  /** Directory holding `spec.config.yaml`. Custom rule paths and ignore globs resolve against it. */
  configDir: string;
}

export interface ResolvedLintConfig {
  rules: LintRule[];
  /** Absolute paths of spec files `lint.ignore` excludes. */
  ignore: string[];
}

/** `off`, `false` and an empty value all mean "do not run this rule". */
function isOff(value: unknown): boolean {
  return value === false || value === null || value === "off";
}

function severityOf(value: unknown): Severity | undefined {
  return typeof value === "string" && SEVERITIES.has(value) ? (value as Severity) : undefined;
}

function describe(value: unknown): string {
  return typeof value === "string" ? `"${value}"` : JSON.stringify(value);
}

/**
 * Turn `lint.extends`, `lint.rules` and `lint.ignore` into the rule set and
 * exclusion list the engine runs with.
 *
 * `lint.rules` and `lint.ignore` were declared in the config schema, documented
 * in the README and CONTRIBUTING, accepted by `validate` — and read by nothing.
 * Only `lint.extends` was ever consumed, so `naming-conventions: off` left the
 * rule firing, a custom rule never loaded (`loadCustomRule` was exported and
 * called by nothing), and `ignore` excluded no file. A team that writes a rule
 * override into CI believes it has configured a gate; the belief is the damage.
 *
 * This is the single place all six linting surfaces resolve their rules, so a
 * fix here cannot reach the CLI and miss the Action or MCP.
 */
export async function resolveLintConfig({
  config,
  preset,
  configDir,
}: ResolveLintConfigOptions): Promise<ResolvedLintConfig> {
  const presetName = preset ?? config?.lint?.extends ?? "recommended";
  const byId = new Map<string, LintRule>(getPreset(presetName).map((rule) => [rule.id, rule]));

  // Every built-in, not just the ones this preset enabled: an override may
  // re-enable a rule the preset left out, which is the other half of being
  // able to turn one off.
  const builtins = new Map<string, LintRule>(allBuiltinRules.map((rule) => [rule.id, rule]));

  for (const [id, value] of Object.entries(config?.lint?.rules ?? {})) {
    if (isOff(value)) {
      // A typo'd id is the same silent no-op as the defect this fixes: the
      // author believes they turned a rule off, and it keeps firing. Refuse
      // rather than delete nothing.
      if (!builtins.has(id)) {
        throw new Error(
          `lint.rules["${id}"]: cannot turn off "${id}" — no built-in rule has that id. Check the spelling.`,
        );
      }
      byId.delete(id);
      continue;
    }

    let severity: Severity | undefined;
    let rulePath: string | undefined;

    if (Array.isArray(value)) {
      severity = severityOf(value[0]);
      if (severity === undefined) {
        throw new Error(
          `lint.rules["${id}"]: ${describe(value[0])} is not a severity. Use "error", "warn", "info", or "off".`,
        );
      }
      const options = value[1];
      if (options !== undefined) {
        if (typeof options !== "object" || options === null || Array.isArray(options)) {
          throw new Error(
            `lint.rules["${id}"]: expected options like { path: "./rule.js" }, got ${describe(options)}.`,
          );
        }
        const declared = (options as { path?: unknown }).path;
        if (declared !== undefined) {
          if (typeof declared !== "string" || declared.length === 0) {
            throw new Error(`lint.rules["${id}"]: \`path\` must be a non-empty string.`);
          }
          rulePath = declared;
        }
      }
    } else {
      severity = severityOf(value);
      if (severity === undefined) {
        throw new Error(
          `lint.rules["${id}"]: ${describe(value)} is not a severity. Use "error", "warn", "info", or "off".`,
        );
      }
    }

    if (rulePath !== undefined) {
      const absolute = isAbsolute(rulePath) ? rulePath : resolve(configDir, rulePath);
      const custom = await loadCustomRule(absolute);
      byId.set(id, { ...custom, id, severity });
      continue;
    }

    const existing = byId.get(id) ?? builtins.get(id);
    if (!existing) {
      throw new Error(
        `lint.rules["${id}"]: no built-in rule with that id. ` +
          `For a custom rule, give it a file: ["${severity}", { path: "./rules/my-rule.js" }].`,
      );
    }
    byId.set(id, { ...existing, severity });
  }

  const ignore: string[] = [];
  for (const pattern of config?.lint?.ignore ?? []) {
    ignore.push(...(await resolveGlob(pattern, configDir)));
  }

  return { rules: [...byId.values()], ignore };
}

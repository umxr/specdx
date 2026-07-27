import { defineCommand } from "citty";
import { loadConfig, parseSpec, resolveGlob, createLogger } from "@specdx/core";
import { runCheck } from "@specdx/check";
import type { Finding } from "@specdx/check";
import type { ParsedSpec } from "@specdx/core";
import { sharedArgs } from "../shared-args.js";

export interface UpdateSuggestion {
  specId: string;
  section: string;
  addition: string;
  reason: string;
}

export interface GenerateUpdatesInput {
  findings: Finding[];
}

export interface GenerateUpdatesResult {
  suggestions: UpdateSuggestion[];
}

function buildRouteAddition(actual: string): string {
  const parts = actual.trim().split(/\s+/);
  const method = parts[0] ?? "GET";
  const path = parts[1] ?? actual;
  return `### ${method} ${path}\nDescription placeholder.`;
}

function buildTypeAddition(actual: string): string {
  return `- ${actual}`;
}

function buildTestAddition(actual: string): string {
  return `- ${actual}`;
}

export function generateUpdates({ findings }: GenerateUpdatesInput): GenerateUpdatesResult {
  const suggestions: UpdateSuggestion[] = [];

  for (const finding of findings) {
    // Only act on extra findings — code has something the spec doesn't know about.
    // missing = code is wrong, spec is correct → skip.
    // mismatch = ambiguous → skip for now, let the user decide.
    if (finding.type !== "extra") continue;

    const actual = finding.actual ?? "";

    if (finding.category === "route") {
      suggestions.push({
        specId: finding.specId,
        section: "Endpoints",
        addition: buildRouteAddition(actual),
        reason: `Route ${actual} exists in code but is not documented in the spec.`,
      });
    } else if (finding.category === "type") {
      suggestions.push({
        specId: finding.specId,
        section: "Data Model",
        addition: buildTypeAddition(actual),
        reason: `${actual} exists in code but is not documented in the spec.`,
      });
    } else if (finding.category === "test") {
      suggestions.push({
        specId: finding.specId,
        section: "Test Cases",
        addition: buildTestAddition(actual),
        reason: `Test case "${actual}" exists in code but is not listed in the spec.`,
      });
    }
  }

  return { suggestions };
}

function printSuggestionsPretty(suggestions: UpdateSuggestion[]): void {
  if (suggestions.length === 0) {
    console.log("\n  sdx update — no spec updates suggested\n");
    return;
  }

  console.log(`\n  sdx update — ${suggestions.length} suggested spec update(s)\n`);

  // Group by specId
  const bySpec = new Map<string, UpdateSuggestion[]>();
  for (const s of suggestions) {
    const list = bySpec.get(s.specId) ?? [];
    list.push(s);
    bySpec.set(s.specId, list);
  }

  for (const [specId, items] of bySpec) {
    console.log(`  ${specId}:`);
    for (const item of items) {
      console.log(`    [${item.section}] ${item.reason}`);
      console.log(`      Add:\n      ${item.addition.replace(/\n/g, "\n      ")}`);
    }
    console.log();
  }

  console.log("  Note: --apply is not implemented in v1. Apply changes manually.\n");
}

export default defineCommand({
  meta: {
    name: "update",
    description: "[experimental] Suggest spec updates based on sdx check findings (--from-code)",
  },
  args: {
    ...sharedArgs,
    "from-code": {
      type: "boolean",
      description: "Generate suggestions from code drift (sdx check findings)",
      default: true,
    },
    spec: { type: "string", description: "Limit to a specific spec ID" },
    framework: { type: "string", description: "Framework override: express, hono, nextjs" },
  },
  async run({ args }) {
    const logger = createLogger({ quiet: args.quiet, verbose: args.verbose });
    const configDir = process.cwd();
    const config = await loadConfig(undefined, configDir);

    logger.debug("Loading specs...");

    const specs: ParsedSpec[] = [];
    for (const [, entry] of Object.entries(config.specs)) {
      const paths = await resolveGlob(entry.path, configDir);
      for (const p of paths) {
        const spec = await parseSpec(p);
        if (args.spec && spec.frontmatter.id !== args.spec) continue;
        specs.push(spec);
      }
    }

    logger.debug(`Running check on ${specs.length} specs...`);

    const checkConfig = {
      ...config.check,
      ...(args.framework
        ? { framework: args.framework as "auto" | "express" | "hono" | "nextjs" }
        : {}),
    };

    const checkResult = await runCheck(specs, configDir, checkConfig);
    const { suggestions } = generateUpdates({ findings: checkResult.findings });

    if (args.format === "json") {
      console.log(JSON.stringify({ suggestions }, null, 2));
    } else {
      printSuggestionsPretty(suggestions);
    }
  },
});

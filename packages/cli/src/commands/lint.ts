import { defineCommand } from "citty";
import { loadConfig, parseSpec, resolveGlob, buildGraph, createLogger } from "@sdx/core";
import { createLintEngine, getPreset, type LintResults } from "@sdx/lint";
import type { ParsedSpec } from "@sdx/core";
import { sharedArgs } from "../shared-args.js";
import { formatPretty } from "../formatters/pretty.js";
import { formatJson } from "../formatters/json.js";
import { formatGithub } from "../formatters/github.js";

export interface RunLintOptions {
  configDir: string;
  specPath?: string;
  preset?: "minimal" | "recommended" | "strict";
}

export async function runLint(options: RunLintOptions): Promise<LintResults> {
  const config = await loadConfig(undefined, options.configDir);
  const preset = options.preset ?? (config.lint?.extends as any) ?? "recommended";
  const rules = getPreset(preset);

  const specs: ParsedSpec[] = [];
  for (const [, entry] of Object.entries(config.specs)) {
    const files = await resolveGlob(entry.path, options.configDir);
    for (const file of files) {
      if (options.specPath && !file.includes(options.specPath)) continue;
      specs.push(await parseSpec(file));
    }
  }

  let graph;
  let graphError: string | undefined;
  try {
    graph = buildGraph(config);
  } catch (err) {
    graphError = (err as Error).message;
  }

  const engine = createLintEngine({ rules, config, graph });
  const results = engine.lint(specs);

  if (graphError) {
    results.diagnostics.push({
      ruleId: "structure/no-circular-deps",
      severity: "error",
      message: graphError,
      filePath: "spec.config.yaml",
    });
    results.hasErrors = true;
  }

  return results;
}

export default defineCommand({
  meta: { name: "lint", description: "Lint all specs in the suite" },
  args: {
    ...sharedArgs,
    fix: { type: "boolean", description: "Auto-fix issues where possible" },
    path: { type: "positional", description: "Lint a specific spec file", required: false },
    preset: { type: "string", description: "Lint preset (minimal, recommended, strict)" },
  },
  async run({ args }) {
    const logger = createLogger({ quiet: args.quiet, verbose: args.verbose });

    if (args.fix) {
      logger.info("No auto-fixable issues supported yet.");
    }

    try {
      const results = await runLint({
        configDir: process.cwd(),
        specPath: args.path,
        preset: args.preset as any,
      });

      const formatter =
        args.format === "json" ? formatJson : args.format === "github" ? formatGithub : formatPretty;
      console.log(formatter(results.diagnostics));

      if (results.hasErrors) process.exit(1);
    } catch (err) {
      console.error(`\n  ✗ ${(err as Error).message}\n`);
      process.exit(1);
    }
  },
});

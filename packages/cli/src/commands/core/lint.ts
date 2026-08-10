import { defineCommand } from "citty";
import { loadConfig, parseSpec, resolveGlob, buildGraph, createLogger } from "@specdx/core";
import { createLintEngine, resolveLintConfig, type LintResults } from "@specdx/lint";
import type { ParsedSpec } from "@specdx/core";
import { sharedArgs, resolveFormat } from "../../shared-args.js";
import { createOutput } from "../../output.js";
import { formatPretty } from "../../formatters/pretty.js";
import { formatJson } from "../../formatters/json.js";
import { formatGithub } from "../../formatters/github.js";

const FORMATS = ["pretty", "json", "github"] as const;

export interface RunLintOptions {
  configDir: string;
  specPath?: string;
  preset?: "minimal" | "recommended" | "strict";
}

/** Lint results plus whether anything was actually linted (vacuous-pass audit). */
export interface RunLintResults extends LintResults {
  /** Number of spec files linted. Named for what it counts, not "count". */
  specFiles: number;
  /** False when no specs resolved — "no diagnostics" is then not a pass. */
  assessed: boolean;
}

export async function runLint(options: RunLintOptions): Promise<RunLintResults> {
  // A JS caller omitting the option otherwise dies as ERR_INVALID_ARG_TYPE
  // deep inside path.join, with no mention of what was missing.
  if (!options.configDir) {
    throw new TypeError("runLint requires `configDir` — the directory holding spec.config.yaml.");
  }
  const config = await loadConfig(undefined, options.configDir);
  const preset = options.preset ?? config.lint?.extends ?? "recommended";
  const { rules, ignore } = await resolveLintConfig({
    config,
    preset,
    configDir: options.configDir,
  });

  // Always parse the full suite so cross-reference rules have complete
  // context; a single-file lint filters the *diagnostics*, not the suite.
  const specs: ParsedSpec[] = [];
  for (const [, entry] of Object.entries(config.specs)) {
    const files = await resolveGlob(entry.path, options.configDir);
    for (const file of files) {
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

  const engine = createLintEngine({ rules, config, graph, ignore });
  const results = engine.lint(specs);

  if (options.specPath) {
    const specPath = options.specPath;
    results.diagnostics = results.diagnostics.filter((d) => d.filePath.includes(specPath));
    results.hasErrors = results.diagnostics.some((d) => d.severity === "error");
    results.hasWarnings = results.diagnostics.some((d) => d.severity === "warn");
  }

  if (graphError) {
    results.diagnostics.push({
      ruleId: "structure/no-circular-deps",
      severity: "error",
      message: graphError,
      filePath: "spec.config.yaml",
    });
    results.hasErrors = true;
  }

  // Count what was actually linted, not what resolved. `lint.ignore` excluding
  // every spec produces no diagnostics, and reporting that as a pass is the
  // vacuous-pass shape one config key over: "0 problems" because nothing was
  // looked at reads identically to "0 problems" because nothing was wrong.
  const ignored = new Set(ignore);
  const linted = specs.filter((spec) => !ignored.has(spec.filePath));

  return { ...results, specFiles: linted.length, assessed: linted.length > 0 };
}

export default defineCommand({
  meta: { name: "lint", description: "Lint all specs in the suite" },
  args: {
    ...sharedArgs(FORMATS),
    fix: { type: "boolean", description: "Auto-fix issues where possible" },
    path: { type: "positional", description: "Lint a specific spec file", required: false },
    preset: { type: "string", description: "Lint preset (minimal, recommended, strict)" },
  },
  async run({ args }) {
    const logger = createLogger({ quiet: args.quiet, verbose: args.verbose });
    const output = createOutput({ quiet: args.quiet });

    const format = resolveFormat(args.format, FORMATS);
    if (!format.ok) {
      console.error(`\n  ✗ ${format.message}\n`);
      process.exit(1);
    }

    if (args.fix) {
      logger.info("No auto-fixable issues supported yet.");
    }

    try {
      const results = await runLint({
        configDir: process.cwd(),
        specPath: args.path,
        preset: args.preset as "minimal" | "recommended" | "strict" | undefined,
      });

      const formatter =
        format.format === "json"
          ? formatJson
          : format.format === "github"
            ? formatGithub
            : formatPretty;
      // "No diagnostics" over an empty suite is not a pass (vacuous-pass audit)
      if (!results.assessed) {
        console.error(
          "\n  ⚠ No specs were linted. Check the spec paths in spec.config.yaml, and whether `lint.ignore` excludes them all.\n",
        );
        process.exit(3);
      }

      const rendered = formatter(results.diagnostics);
      // A clean pretty run is chrome; diagnostics and machine formats are not.
      if (format.format === "pretty" && results.diagnostics.length === 0) {
        output.info(rendered);
      } else {
        output.out(rendered);
      }

      if (results.hasErrors) process.exit(1);
    } catch (err) {
      console.error(`\n  ✗ ${(err as Error).message}\n`);
      process.exit(1);
    }
  },
});

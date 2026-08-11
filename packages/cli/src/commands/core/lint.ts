import { defineCommand } from "citty";
import { loadConfig, parseSpec, resolveGlob, buildGraph, createLogger } from "@specdx/core";
import {
  createLintEngine,
  resolveLintConfig,
  lintAgentFiles,
  type LintResults,
} from "@specdx/lint";
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
  /**
   * Agent instruction files linted. Zero when `agents` is not configured, which
   * is not a failure — the feature is opt-in. A configured `agents.paths` that
   * matches nothing is reported as an error diagnostic instead, because that
   * is a config promising a check that is not running.
   */
  agentFiles: number;
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

  // One definition of "does --path select this file", shared by the diagnostic
  // filter below and the assessed count further down. Two copies of this
  // predicate would be free to disagree, and a count that disagrees with the
  // filter is exactly how the vacuous pass got in: `--path` filtered the
  // diagnostics to nothing while the count still described the whole suite, so
  // a path matching no spec rendered as "All specs pass lint checks", exit 0.
  const { specPath } = options;
  const selects = (filePath: string) => specPath === undefined || filePath.includes(specPath);

  if (specPath !== undefined) {
    results.diagnostics = results.diagnostics.filter((d) => selects(d.filePath));
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

  // Agent instruction files — AGENTS.md, CLAUDE.md. Opt-in via the `agents`
  // key, so upgrading specdx never adds diagnostics to a suite that did not
  // ask for them, and `lint.extends: strict` cannot promote someone's CLAUDE.md
  // findings to build failures. These are not specs: they are absent from
  // `allSpecs`, the graph, and every `--path` calculation above.
  let agentFiles = 0;
  if (config.agents) {
    const agentResults = await lintAgentFiles({ config, configDir: options.configDir });
    agentFiles = agentResults.filesLinted;

    if (!agentResults.assessed) {
      // A config that promises agent linting and inspects nothing is the
      // vacuous-pass shape again — silence here would read as "your agent
      // files are fine". An error diagnostic rather than exit 3, because the
      // specs above *were* assessed, and machine formats must show it.
      const patterns = config.agents.paths ?? ["AGENTS.md", "CLAUDE.md"];
      results.diagnostics.push({
        ruleId: "agents/paths-match-nothing",
        severity: "error",
        message: `agents.paths matched no files (${patterns.join(", ")}), so no agent instruction file was linted. Remove the \`agents\` key or fix the paths.`,
        filePath: "spec.config.yaml",
      });
      results.hasErrors = true;
    }

    // A single-file lint narrows agent diagnostics the same way it narrows
    // spec ones; anything else would leak findings from files the user did
    // not ask about. Through the same `selects` predicate, not a second copy
    // of it — a second copy is precisely the bug #53 fixed.
    for (const diagnostic of agentResults.diagnostics) {
      if (!selects(diagnostic.filePath)) continue;
      results.diagnostics.push(diagnostic);
      if (diagnostic.severity === "error") results.hasErrors = true;
      if (diagnostic.severity === "warn") results.hasWarnings = true;
    }
  }

  // Count what was actually linted, not what resolved. `lint.ignore` excluding
  // every spec produces no diagnostics, and reporting that as a pass is the
  // vacuous-pass shape one config key over: "0 problems" because nothing was
  // looked at reads identically to "0 problems" because nothing was wrong.
  // `--path` narrows the same way, so it has to narrow this count too.
  const ignored = new Set(ignore);
  const linted = specs.filter((spec) => !ignored.has(spec.filePath) && selects(spec.filePath));

  return { ...results, specFiles: linted.length, assessed: linted.length > 0, agentFiles };
}

/**
 * What a clean run says it checked.
 *
 * Exported for tests: this string is the only thing a passing run shows a
 * user, so it is the thing worth asserting on.
 */
export function cleanRunMessage(results: Pick<RunLintResults, "specFiles" | "agentFiles">): string {
  const parts = [`${results.specFiles} ${results.specFiles === 1 ? "spec" : "specs"}`];
  if (results.agentFiles > 0) {
    parts.push(`${results.agentFiles} agent ${results.agentFiles === 1 ? "file" : "files"}`);
  }
  return `  ✓ ${parts.join(" and ")} checked, no problems found.\n`;
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
      // "No diagnostics" over an empty selection is not a pass (vacuous-pass
      // audit). Name the actual cause: sending someone to spec.config.yaml when
      // they mistyped `--path` is a worse hint than no hint.
      if (!results.assessed) {
        console.error(
          args.path
            ? `\n  ⚠ No specs matched path "${args.path}", so nothing was linted. Check it against the specs declared in spec.config.yaml.\n`
            : "\n  ⚠ No specs were linted. Check the spec paths in spec.config.yaml, and whether `lint.ignore` excludes them all.\n",
        );
        process.exit(3);
      }

      const rendered = formatter(results.diagnostics);
      // A clean pretty run is chrome; diagnostics and machine formats are not.
      if (format.format === "pretty" && results.diagnostics.length === 0) {
        // Say what was assessed, not just that nothing was wrong. With agent
        // linting configured, "All specs pass" is silent about whether the
        // agent files were looked at — and a clean run that skipped them
        // reads identically to one that checked them.
        output.info(cleanRunMessage(results));
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

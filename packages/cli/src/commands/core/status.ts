import { defineCommand } from "citty";
import { loadConfig, parseSpec, buildGraph, resolveGlob } from "@specdx/core";
import { createLintEngine, resolveLintConfig } from "@specdx/lint";
import { DEFAULT_DIFF_CONFIG } from "@specdx/diff";
import type { StatusResult } from "@specdx/diff";
import type { ParsedSpec } from "@specdx/core";
import { sharedArgs, resolveFormat } from "../../shared-args.js";
import { createOutput } from "../../output.js";

const FORMATS = ["pretty", "json", "github"] as const;

export interface RunStatusOptions {
  /**
   * Directory holding spec.config.yaml. Defaults to the process cwd, which is
   * right for the CLI and useless to a library consumer — `runLint` and
   * `runPack` take one, so this does too (audit run 5, F8).
   */
  configDir?: string;
}

export async function runStatus(options: RunStatusOptions = {}): Promise<StatusResult> {
  const configDir = options.configDir ?? process.cwd();
  const config = await loadConfig(undefined, configDir);

  // Resolve and parse all specs
  const specs: { spec: ParsedSpec; entry: { path: string; owner?: string } }[] = [];
  for (const [, entry] of Object.entries(config.specs)) {
    const paths = await resolveGlob(entry.path, configDir);
    for (const p of paths) {
      const spec = await parseSpec(p);
      specs.push({ spec, entry: entry as { path: string; owner?: string } });
    }
  }

  // Count by status
  const byStatus: Record<string, number> = {};
  for (const { spec } of specs) {
    const status = (spec.frontmatter.status as string) || "unknown";
    byStatus[status] = (byStatus[status] ?? 0) + 1;
  }

  // Lint health
  const presetName = config.lint?.extends ?? "recommended";
  const { rules, ignore } = await resolveLintConfig({
    config,
    preset: presetName,
    configDir,
  });

  let graph;
  let graphError: string | undefined;
  try {
    graph = buildGraph(config);
  } catch (err) {
    graphError = (err as Error).message;
  }

  const engine = createLintEngine({ rules, config, graph, ignore });
  const lintResults = engine.lint(specs.map((s) => s.spec));

  if (graphError) {
    lintResults.diagnostics.push({
      ruleId: "structure/no-circular-deps",
      severity: "error",
      message: graphError,
      filePath: "spec.config.yaml",
    });
    lintResults.hasErrors = true;
  }

  const errors = lintResults.diagnostics.filter((d) => d.severity === "error").length;
  const warnings = lintResults.diagnostics.filter((d) => d.severity === "warn").length;

  // Specs carrying no error-severity diagnostic.
  //
  // This was `specs.length - errors`, which subtracts a diagnostic count from a
  // spec count -- one spec with seven errors reported `passing: -6`. The units
  // only agree when `errors` is 0, which is every suite the fixtures use
  // (audit run 6, G2).
  const specsWithErrors = new Set(
    lintResults.diagnostics.filter((d) => d.severity === "error").map((d) => d.filePath),
  );
  const passing = specs.filter(({ spec }) => !specsWithErrors.has(spec.filePath)).length;

  // Staleness
  const thresholdDays =
    config.diff?.staleness_threshold_days ?? DEFAULT_DIFF_CONFIG.staleness_threshold_days;
  const now = Date.now();
  const staleSpecs: { specId: string; daysSinceUpdate: number; owner?: string }[] = [];
  for (const { spec, entry } of specs) {
    const dateStr =
      (spec.frontmatter.updated as string | undefined) ||
      (spec.frontmatter.created as string | undefined);
    if (dateStr) {
      const daysSinceUpdate = Math.floor(
        (now - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24),
      );
      if (daysSinceUpdate > thresholdDays) {
        staleSpecs.push({
          specId: spec.frontmatter.id as string,
          daysSinceUpdate,
          owner: entry.owner,
        });
      }
    }
  }

  // Integrity issues
  const integrityIssues: string[] = [];
  if (graphError) {
    integrityIssues.push(graphError);
  }
  const refErrors = lintResults.diagnostics.filter(
    (d) => d.ruleId === "structure/valid-references",
  );
  for (const d of refErrors) {
    integrityIssues.push(d.message);
  }

  // Verdict — an empty suite is unassessed, never a vacuous "healthy"
  let verdict: StatusResult["verdict"] = "healthy";
  if (errors > 0) verdict = "errors";
  else if (warnings > 0 || staleSpecs.length > 0) verdict = "warnings";
  else if (specs.length === 0) verdict = "unassessed";

  return {
    project: config.project?.name ?? "unknown",
    specFiles: specs.length,
    byStatus,
    lintHealth: { errors, warnings, passing },
    staleSpecs,
    integrityIssues,
    verdict,
  };
}

export default defineCommand({
  meta: { name: "status", description: "Show spec suite health overview" },
  args: { ...sharedArgs(FORMATS) },
  async run({ args }) {
    const format = resolveFormat(args.format, FORMATS);
    if (!format.ok) {
      console.error(`\n  ✗ ${format.message}\n`);
      process.exit(1);
    }
    const output = createOutput({ quiet: args.quiet });

    try {
      const result = await runStatus();

      if (format.format === "json") {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (format.format === "github") {
        // A headline always, at the level the verdict reports.
        //
        // This block used to render stale specs and integrity issues and
        // nothing else, so a suite whose only problem was lint errors emitted
        // zero bytes and exited 0 -- a workflow step showing nothing, on a run
        // whose own JSON said `verdict: "errors"` (audit run 6, G1). `check`
        // was given a headline for exactly this reason; status renders the same
        // format and was left able to say nothing at all.
        //
        // The level tracks the pretty renderer's icon so the two renderers of
        // one command cannot disagree. Lint diagnostics are deliberately not
        // re-annotated here -- `lint --format github` owns those, and a
        // workflow running both should not get each one twice.
        const level =
          result.verdict === "errors"
            ? "error"
            : result.verdict === "healthy"
              ? "notice"
              : "warning";
        console.log(
          `::${level}::specdx status — ${result.project} — ${result.verdict}: ` +
            `${result.specFiles} spec file(s), ${result.lintHealth.errors} error(s), ` +
            `${result.lintHealth.warnings} warning(s)`,
        );
        if (result.verdict === "unassessed") {
          console.log(
            "::warning::No specs resolved — nothing was assessed. Check the spec paths in spec.config.yaml.",
          );
        }
        for (const s of result.staleSpecs) {
          console.log(
            `::warning::Spec "${s.specId}" is stale (${s.daysSinceUpdate} days since update)`,
          );
        }
        for (const issue of result.integrityIssues) {
          console.log(`::error::${issue}`);
        }
        return;
      }

      // Pretty format
      const icon =
        result.verdict === "healthy"
          ? "✓"
          : result.verdict === "warnings" || result.verdict === "unassessed"
            ? "⚠"
            : "✗";
      const healthy = result.verdict === "healthy";
      const headline = `\n  ${icon} ${result.project} — ${result.verdict}`;
      if (healthy) output.info(headline);
      else output.out(headline);

      if (result.verdict === "unassessed") {
        output.out(
          "    No specs resolved — nothing was assessed. Check the spec paths in spec.config.yaml.",
        );
      }
      output.info(
        `    ${result.specFiles} specs: ${Object.entries(result.byStatus)
          .map(([k, v]) => `${v} ${k}`)
          .join(", ")}`,
      );
      output.info(
        `    Lint: ${result.lintHealth.errors} errors, ${result.lintHealth.warnings} warnings`,
      );

      if (result.staleSpecs.length > 0) {
        output.out(
          `    Stale: ${result.staleSpecs.map((s) => `${s.specId} (${s.daysSinceUpdate}d)`).join(", ")}`,
        );
      }
      if (result.integrityIssues.length > 0) {
        output.out(`    Issues: ${result.integrityIssues.join("; ")}`);
      }
      output.info();
    } catch (err) {
      console.error(`\n  ✗ ${(err as Error).message}\n`);
      process.exit(1);
    }
  },
});

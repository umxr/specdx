import { defineCommand } from "citty";
import { loadConfig, parseSpec, buildGraph, resolveGlob } from "@specdx/core";
import { createLintEngine, getPreset } from "@specdx/lint";
import { DEFAULT_DIFF_CONFIG } from "@specdx/diff";
import type { StatusResult } from "@specdx/diff";
import type { ParsedSpec } from "@specdx/core";

export async function runStatus(_options: { format?: string } = {}): Promise<StatusResult> {
  const configDir = process.cwd();
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
  const rules = getPreset(presetName);

  let graph;
  let graphError: string | undefined;
  try {
    graph = buildGraph(config);
  } catch (err) {
    graphError = (err as Error).message;
  }

  const engine = createLintEngine({ rules, config, graph });
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

  // Verdict
  let verdict: "healthy" | "warnings" | "errors" = "healthy";
  if (errors > 0) verdict = "errors";
  else if (warnings > 0 || staleSpecs.length > 0) verdict = "warnings";

  return {
    project: config.project?.name ?? "unknown",
    specCount: specs.length,
    byStatus,
    lintHealth: { errors, warnings, passing: specs.length - errors },
    staleSpecs,
    integrityIssues,
    verdict,
  };
}

export default defineCommand({
  meta: { name: "status", description: "Show spec suite health overview" },
  args: {
    format: {
      type: "string",
      description: "Output format: pretty, json, github",
      default: "pretty",
    },
  },
  async run({ args }) {
    try {
      const result = await runStatus({ format: args.format });

      if (args.format === "json") {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      if (args.format === "github") {
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
      const icon = result.verdict === "healthy" ? "✓" : result.verdict === "warnings" ? "⚠" : "✗";
      console.log(`\n  ${icon} ${result.project} — ${result.verdict}`);
      console.log(
        `    ${result.specCount} specs: ${Object.entries(result.byStatus)
          .map(([k, v]) => `${v} ${k}`)
          .join(", ")}`,
      );
      console.log(
        `    Lint: ${result.lintHealth.errors} errors, ${result.lintHealth.warnings} warnings`,
      );

      if (result.staleSpecs.length > 0) {
        console.log(
          `    Stale: ${result.staleSpecs.map((s) => `${s.specId} (${s.daysSinceUpdate}d)`).join(", ")}`,
        );
      }
      if (result.integrityIssues.length > 0) {
        console.log(`    Issues: ${result.integrityIssues.join("; ")}`);
      }
      console.log();
    } catch (err) {
      console.error(`\n  ✗ ${(err as Error).message}\n`);
      process.exit(1);
    }
  },
});

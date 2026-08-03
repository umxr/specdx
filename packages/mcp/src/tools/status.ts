import { loadConfig, parseSpec, resolveGlob, buildGraph } from "@specdx/core";
import { createLintEngine, getPreset } from "@specdx/lint";
import { DEFAULT_DIFF_CONFIG } from "@specdx/diff";
import type { ParsedSpec } from "@specdx/core";

export async function handleStatus(): Promise<string> {
  const configDir = process.cwd();
  const config = await loadConfig(undefined, configDir);

  const specs: { spec: ParsedSpec; entry: { path: string; owner?: string } }[] = [];
  for (const [, entry] of Object.entries(config.specs)) {
    const paths = await resolveGlob(entry.path, configDir);
    for (const p of paths) {
      const spec = await parseSpec(p);
      specs.push({ spec, entry: entry as { path: string; owner?: string } });
    }
  }

  const byStatus: Record<string, number> = {};
  for (const { spec } of specs) {
    const status = (spec.frontmatter.status as string) || "unknown";
    byStatus[status] = (byStatus[status] ?? 0) + 1;
  }

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

  const errors = lintResults.diagnostics.filter((d) => d.severity === "error").length;
  const warnings = lintResults.diagnostics.filter((d) => d.severity === "warn").length;

  const thresholdDays =
    config.diff?.staleness_threshold_days ?? DEFAULT_DIFF_CONFIG.staleness_threshold_days;
  const now = Date.now();
  const staleSpecs: { specId: string; daysSinceUpdate: number; owner?: string }[] = [];
  for (const { spec, entry } of specs) {
    const dateStr =
      (spec.frontmatter.updated as string | undefined) ||
      (spec.frontmatter.created as string | undefined);
    if (dateStr) {
      const days = Math.floor((now - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
      if (days > thresholdDays) {
        staleSpecs.push({
          specId: spec.frontmatter.id as string,
          daysSinceUpdate: days,
          owner: entry.owner,
        });
      }
    }
  }

  // An empty suite is unassessed, never a vacuous "healthy" (vacuous-pass audit)
  let verdict: "healthy" | "warnings" | "errors" | "unassessed" = "healthy";
  if (errors > 0 || graphError) verdict = "errors";
  else if (warnings > 0 || staleSpecs.length > 0) verdict = "warnings";
  else if (specs.length === 0) verdict = "unassessed";

  return JSON.stringify({
    project: config.project?.name ?? "unknown",
    specCount: specs.length,
    byStatus,
    lintHealth: { errors, warnings, passing: specs.length - errors },
    staleSpecs,
    integrityIssues: graphError ? [graphError] : [],
    verdict,
  });
}

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

  // Specs carrying no error-severity diagnostic.
  //
  // This was `specs.length - errors` here too, and the CLI-side fix did not
  // reach it: this handler is a near-copy of `runStatus`, so a repair to one
  // leaves the other reporting a negative number of passing specs. Kept in step
  // by the parity test in the CLI package (audit run 6, G2).
  const specsWithErrors = new Set(
    lintResults.diagnostics.filter((d) => d.severity === "error").map((d) => d.filePath),
  );
  const passing = specs.filter(({ spec }) => !specsWithErrors.has(spec.filePath)).length;

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
    // `specFiles` only. A second field named `specCount` gives a consumer no
    // way to know whether it counts config entries or resolved files -- the
    // ambiguity `sdx_validate` was already cleaned up to avoid.
    specFiles: specs.length,
    byStatus,
    lintHealth: { errors, warnings, passing },
    staleSpecs,
    integrityIssues: graphError ? [graphError] : [],
    verdict,
  });
}

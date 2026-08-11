import { loadConfig, parseSpec, resolveGlob, buildGraph } from "@specdx/core";
import { createLintEngine, resolveLintConfig } from "@specdx/lint";
import type { ParsedSpec } from "@specdx/core";

/**
 * `sdx_lint` is a near-copy of `runLint`, not a caller of it — the CLI depends
 * on this package, so the dependency cannot run the other way. See
 * `packages/cli/src/lint-parity.test.ts`, which pins the two together.
 *
 * Two divergences were fixed here, both found while dogfooding on 2026-08-11:
 *
 * 1. `specPath` filtered the specs *before* linting, so a single-file lint had
 *    no sight of the rest of the suite and cross-reference rules could not
 *    fire. The CLI has always linted the whole suite and filtered the
 *    resulting diagnostics; that is the correct behaviour and this now matches.
 * 2. A `specPath` matching no spec returned `hasErrors: false` with no signal
 *    that nothing had been assessed, which reads to a caller as a clean pass.
 */
export async function handleLint(params: { preset?: string; specPath?: string }): Promise<string> {
  const configDir = process.cwd();
  const config = await loadConfig(undefined, configDir);
  const preset = params.preset ?? config.lint?.extends ?? "recommended";
  const { rules, ignore } = await resolveLintConfig({
    config,
    preset: preset,
    configDir,
  });

  // Always parse the full suite so cross-reference rules have complete
  // context; a single-file lint filters the *diagnostics*, not the suite.
  const specs: ParsedSpec[] = [];
  for (const [, entry] of Object.entries(config.specs)) {
    const files = await resolveGlob(entry.path, configDir);
    for (const file of files) {
      specs.push(await parseSpec(file));
    }
  }

  let graph;
  try {
    graph = buildGraph(config);
  } catch {
    // non-fatal
  }

  const engine = createLintEngine({ rules, config, graph, ignore });
  const results = engine.lint(specs);

  // One definition of "does specPath select this file", shared by the
  // diagnostic filter and the assessed count, so the two cannot disagree.
  const { specPath } = params;
  const selects = (filePath: string) => specPath === undefined || filePath.includes(specPath);

  let diagnostics = results.diagnostics;
  let { hasErrors, hasWarnings } = results;
  if (specPath !== undefined) {
    diagnostics = diagnostics.filter((d) => selects(d.filePath));
    hasErrors = diagnostics.some((d) => d.severity === "error");
    hasWarnings = diagnostics.some((d) => d.severity === "warn");
  }

  const ignored = new Set(ignore);
  const linted = specs.filter((spec) => !ignored.has(spec.filePath) && selects(spec.filePath));

  return JSON.stringify({
    diagnostics,
    hasErrors,
    hasWarnings,
    specsChecked: linted.length,
    // False when nothing was selected — "no diagnostics" is then not a pass.
    assessed: linted.length > 0,
  });
}

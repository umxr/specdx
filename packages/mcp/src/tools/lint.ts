import { loadConfig, parseSpec, resolveGlob, buildGraph } from "@specdx/core";
import { createLintEngine, resolveLintConfig } from "@specdx/lint";
import type { ParsedSpec } from "@specdx/core";

export async function handleLint(params: { preset?: string; specPath?: string }): Promise<string> {
  const configDir = process.cwd();
  const config = await loadConfig(undefined, configDir);
  const preset = params.preset ?? config.lint?.extends ?? "recommended";
  const { rules, ignore } = await resolveLintConfig({
    config,
    preset: preset,
    configDir,
  });

  const specs: ParsedSpec[] = [];
  for (const [, entry] of Object.entries(config.specs)) {
    const files = await resolveGlob(entry.path, configDir);
    for (const file of files) {
      if (params.specPath && !file.includes(params.specPath)) continue;
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

  return JSON.stringify({
    diagnostics: results.diagnostics,
    hasErrors: results.hasErrors,
    hasWarnings: results.hasWarnings,
    specsChecked: specs.length,
  });
}

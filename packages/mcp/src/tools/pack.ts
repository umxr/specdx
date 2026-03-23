import { loadConfig, parseSpec, resolveGlob, buildGraph } from "@specdx/core";
import { pack } from "@specdx/pack";
import type { ParsedSpec } from "@specdx/core";

export async function handlePack(params: {
  task?: string;
  format?: string;
  budget?: number;
}): Promise<string> {
  const configDir = process.cwd();
  const config = await loadConfig(undefined, configDir);

  const allSpecs: ParsedSpec[] = [];
  for (const [, entry] of Object.entries(config.specs)) {
    const files = await resolveGlob(entry.path, configDir);
    for (const file of files) {
      allSpecs.push(await parseSpec(file));
    }
  }

  let graph;
  try {
    graph = buildGraph(config);
  } catch {
    // non-fatal
  }

  const result = pack(
    allSpecs,
    {
      task: params.task,
      budget: params.budget,
      format: (params.format as "xml" | "markdown" | "json") ?? undefined,
    },
    config.pack,
    graph,
  );

  return result.output;
}

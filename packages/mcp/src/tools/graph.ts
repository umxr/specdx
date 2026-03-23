import { loadConfig, buildGraph, GraphError } from "@specdx/core";

export async function handleGraph(params: { format?: string }): Promise<string> {
  const configDir = process.cwd();
  const config = await loadConfig(undefined, configDir);

  try {
    const graph = buildGraph(config);
    const sorted = graph.topologicalSort();

    if (params.format === "dot") {
      const lines = ["digraph specs {"];
      for (const edge of graph.edges) lines.push(`  "${edge.from}" -> "${edge.to}";`);
      lines.push("}");
      return lines.join("\n");
    }

    return JSON.stringify({
      nodes: sorted,
      edges: graph.edges,
      downstream: Object.fromEntries(sorted.map((n) => [n, graph.getDownstream(n)])),
    });
  } catch (err) {
    if (err instanceof GraphError) {
      return JSON.stringify({ error: err.message });
    }
    throw err;
  }
}

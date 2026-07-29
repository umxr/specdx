import {
  loadConfig,
  buildGraph,
  GraphError,
  parseSpec,
  resolveGlob,
  collectReferenceEdges,
  findUnreflectedReferences,
} from "@specdx/core";
import type { ParsedSpec } from "@specdx/core";

export async function handleGraph(params: { format?: string }): Promise<string> {
  const configDir = process.cwd();
  const config = await loadConfig(undefined, configDir);

  try {
    const graph = buildGraph(config);
    const sorted = graph.topologicalSort();

    const idToEntry = new Map<string, string>();
    const specs: ParsedSpec[] = [];
    for (const [key, entry] of Object.entries(config.specs)) {
      const paths = await resolveGlob(entry.path, configDir);
      for (const p of paths) {
        const spec = await parseSpec(p);
        specs.push(spec);
        if (typeof spec.frontmatter.id === "string") {
          idToEntry.set(spec.frontmatter.id, key);
        }
      }
    }
    const referenceEdges = collectReferenceEdges(specs);
    const unreflectedReferences = findUnreflectedReferences(referenceEdges, idToEntry, graph);

    if (params.format === "dot") {
      const lines = ["digraph specs {"];
      for (const edge of graph.edges) lines.push(`  "${edge.from}" -> "${edge.to}";`);
      for (const ref of referenceEdges) {
        lines.push(
          `  "${ref.fromId}" -> "${ref.toId}" [style=dashed, label="${ref.relationship}"];`,
        );
      }
      lines.push("}");
      return lines.join("\n");
    }

    return JSON.stringify({
      nodes: sorted,
      edges: graph.edges,
      downstream: Object.fromEntries(sorted.map((n) => [n, graph.getDownstream(n)])),
      referenceEdges,
      unreflectedReferences,
    });
  } catch (err) {
    if (err instanceof GraphError) {
      return JSON.stringify({ error: err.message });
    }
    throw err;
  }
}

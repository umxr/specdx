import type { SdxConfig } from "@specdx/schema";

export class GraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphError";
  }
}

export interface Edge {
  from: string;
  to: string;
}

export interface DependencyGraph {
  nodes: string[];
  edges: Edge[];
  topologicalSort(): string[];
  getDownstream(nodeId: string): string[];
  getUpstream(nodeId: string): string[];
}

export function buildGraph(config: SdxConfig): DependencyGraph {
  const specNames = Object.keys(config.specs);
  const adjacency = new Map<string, string[]>();
  const reverseAdj = new Map<string, string[]>();
  const edges: Edge[] = [];

  for (const name of specNames) {
    adjacency.set(name, []);
    reverseAdj.set(name, []);
  }

  for (const [name, entry] of Object.entries(config.specs)) {
    if (!entry.requires) continue;
    for (const dep of entry.requires) {
      if (!adjacency.has(dep)) {
        throw new GraphError(
          `Spec "${name}" requires "${dep}", which does not exist in the config.`,
        );
      }
      adjacency.get(dep)!.push(name);
      reverseAdj.get(name)!.push(dep);
      edges.push({ from: dep, to: name });
    }
  }

  // Kahn's algorithm for cycle detection + topological sort
  const inDegree = new Map<string, number>();
  for (const name of specNames) inDegree.set(name, reverseAdj.get(name)!.length);

  const queue: string[] = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) queue.push(name);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const neighbor of adjacency.get(node)!) {
      const newDegree = inDegree.get(neighbor)! - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== specNames.length) {
    const remaining = specNames.filter((n) => !sorted.includes(n));
    throw new GraphError(`Circular dependency detected involving: ${remaining.join(", ")}`);
  }

  return {
    nodes: specNames,
    edges,
    topologicalSort: () => [...sorted],
    getDownstream(nodeId: string): string[] {
      const visited = new Set<string>();
      const stack = [nodeId];
      while (stack.length > 0) {
        const current = stack.pop()!;
        for (const neighbor of adjacency.get(current) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            stack.push(neighbor);
          }
        }
      }
      return [...visited];
    },
    getUpstream(nodeId: string): string[] {
      const visited = new Set<string>();
      const stack = [nodeId];
      while (stack.length > 0) {
        const current = stack.pop()!;
        for (const dep of reverseAdj.get(current) ?? []) {
          if (!visited.has(dep)) {
            visited.add(dep);
            stack.push(dep);
          }
        }
      }
      return [...visited];
    },
  };
}

/** A relationship edge declared in a spec's frontmatter `references`. */
export interface ReferenceEdge {
  fromId: string;
  toId: string;
  relationship: string;
}

/** Reference relationships that imply a dependency, and its direction. */
const DEPENDENCY_RELATIONSHIPS: Record<string, "self-requires-target" | "target-requires-self"> = {
  "depends-on": "self-requires-target",
  "decomposed-into": "target-requires-self",
  "implemented-by": "target-requires-self",
};

/**
 * Collect relationship edges declared in spec frontmatter `references` fields.
 * Edges point from the declaring spec's id to the referenced spec's id.
 */
export function collectReferenceEdges(
  specs: { frontmatter: Record<string, unknown> }[],
): ReferenceEdge[] {
  const edges: ReferenceEdge[] = [];
  for (const spec of specs) {
    const fromId = spec.frontmatter.id;
    if (typeof fromId !== "string") continue;
    const refs = spec.frontmatter.references;
    if (!Array.isArray(refs)) continue;
    for (const ref of refs) {
      if (ref && typeof ref === "object" && "id" in ref) {
        const r = ref as { id: unknown; relationship?: unknown };
        if (typeof r.id === "string") {
          edges.push({
            fromId,
            toId: r.id,
            relationship: typeof r.relationship === "string" ? r.relationship : "related-to",
          });
        }
      }
    }
  }
  return edges;
}

/**
 * Find dependency-implying frontmatter references that the config-level
 * `requires` graph does not reflect. `idToEntry` maps spec frontmatter ids to
 * config entry keys. References within the same entry (e.g. story-to-story
 * under one glob) and references to unmapped ids are skipped — reference
 * existence itself is the `structure/valid-references` lint rule's concern.
 */
export function findUnreflectedReferences(
  referenceEdges: ReferenceEdge[],
  idToEntry: Map<string, string>,
  graph: DependencyGraph,
): { edge: ReferenceEdge; requiringEntry: string; requiredEntry: string }[] {
  const configEdges = new Set(graph.edges.map((e) => `${e.from}→${e.to}`));
  const missing: { edge: ReferenceEdge; requiringEntry: string; requiredEntry: string }[] = [];

  for (const edge of referenceEdges) {
    const direction = DEPENDENCY_RELATIONSHIPS[edge.relationship];
    if (!direction) continue;

    const selfEntry = idToEntry.get(edge.fromId);
    const targetEntry = idToEntry.get(edge.toId);
    if (!selfEntry || !targetEntry || selfEntry === targetEntry) continue;

    const requiringEntry = direction === "self-requires-target" ? selfEntry : targetEntry;
    const requiredEntry = direction === "self-requires-target" ? targetEntry : selfEntry;

    // Config edges point dependency → dependent
    if (!configEdges.has(`${requiredEntry}→${requiringEntry}`)) {
      missing.push({ edge, requiringEntry, requiredEntry });
    }
  }

  return missing;
}

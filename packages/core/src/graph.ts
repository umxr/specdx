import type { SdxConfig } from "@sdx/schema";

export class GraphError extends Error {
  constructor(message: string) { super(message); this.name = "GraphError"; }
}

export interface Edge { from: string; to: string; }

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
        throw new GraphError(`Spec "${name}" requires "${dep}", which does not exist in the config.`);
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
  for (const [name, degree] of inDegree) { if (degree === 0) queue.push(name); }

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
          if (!visited.has(neighbor)) { visited.add(neighbor); stack.push(neighbor); }
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
          if (!visited.has(dep)) { visited.add(dep); stack.push(dep); }
        }
      }
      return [...visited];
    },
  };
}

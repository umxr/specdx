import { defineCommand } from "citty";
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
import { sharedArgs } from "../shared-args.js";

export default defineCommand({
  meta: { name: "graph", description: "Print the spec dependency graph" },
  args: { ...sharedArgs },
  async run({ args }) {
    let config;
    const configDir = process.cwd();
    try {
      config = await loadConfig(undefined, configDir);
    } catch (err) {
      console.error(`\n  ✗ ${(err as Error).message}\n`);
      process.exit(1);
    }
    try {
      const graph = buildGraph(config);
      const sorted = graph.topologicalSort();

      // Frontmatter references are a second, richer source of relationships;
      // surface them alongside config requires instead of silently ignoring
      // them (issue #8).
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
      const unreflected = findUnreflectedReferences(referenceEdges, idToEntry, graph);

      if (args.format === "dot") {
        console.log("digraph specs {");
        for (const edge of graph.edges) console.log(`  "${edge.from}" -> "${edge.to}";`);
        for (const ref of referenceEdges) {
          console.log(
            `  "${ref.fromId}" -> "${ref.toId}" [style=dashed, label="${ref.relationship}"];`,
          );
        }
        console.log("}");
        return;
      }

      console.log("\n  Spec Dependency Graph:\n");
      for (const node of sorted) {
        const downstream = graph.getDownstream(node);
        const arrow = downstream.length > 0 ? ` → ${downstream.join(", ")}` : "";
        console.log(`  ${node}${arrow}`);
      }

      if (referenceEdges.length > 0) {
        console.log("\n  Reference edges (frontmatter):\n");
        for (const ref of referenceEdges) {
          console.log(`  ${ref.fromId} —${ref.relationship}→ ${ref.toId}`);
        }
      }

      if (unreflected.length > 0) {
        console.log("\n  ⚠ References not reflected in config requires:\n");
        for (const { edge, requiringEntry, requiredEntry } of unreflected) {
          console.log(
            `  ${edge.fromId} ${edge.relationship} ${edge.toId} — add "requires: [${requiredEntry}]" to the "${requiringEntry}" entry in spec.config.yaml`,
          );
        }
      }

      console.log("");
    } catch (err) {
      if (err instanceof GraphError) {
        console.error(`  ✗ ${err.message}`);
        process.exit(1);
      }
      throw err;
    }
  },
});

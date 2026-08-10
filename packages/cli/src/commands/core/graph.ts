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
import { sharedArgs, resolveFormat } from "../../shared-args.js";
import { createOutput } from "../../output.js";

const FORMATS = ["pretty", "json", "dot"] as const;

export default defineCommand({
  meta: { name: "graph", description: "Print the spec dependency graph" },
  args: { ...sharedArgs(FORMATS) },
  async run({ args }) {
    const format = resolveFormat(args.format, FORMATS);
    if (!format.ok) {
      console.error(`\n  ✗ ${format.message}\n`);
      process.exit(1);
    }
    const output = createOutput({ quiet: args.quiet });

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

      if (format.format === "json") {
        console.log(
          JSON.stringify(
            {
              nodes: sorted,
              edges: graph.edges,
              referenceEdges,
              unreflectedReferences: unreflected.map(
                ({ edge, requiringEntry, requiredEntry, createsCycle }) => ({
                  from: edge.fromId,
                  to: edge.toId,
                  relationship: edge.relationship,
                  requiringEntry,
                  requiredEntry,
                  createsCycle,
                }),
              ),
            },
            null,
            2,
          ),
        );
        return;
      }

      if (format.format === "dot") {
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

      output.info("\n  Spec Dependency Graph:\n");
      for (const node of sorted) {
        const downstream = graph.getDownstream(node);
        const arrow = downstream.length > 0 ? ` → ${downstream.join(", ")}` : "";
        output.out(`  ${node}${arrow}`);
      }

      if (referenceEdges.length > 0) {
        output.info("\n  Reference edges (frontmatter):\n");
        for (const ref of referenceEdges) {
          output.out(`  ${ref.fromId} —${ref.relationship}→ ${ref.toId}`);
        }
      }

      const suggestions = unreflected.filter((u) => !u.createsCycle);
      const conflicts = unreflected.filter((u) => u.createsCycle);

      if (suggestions.length > 0) {
        console.log("\n  ⚠ References not reflected in config requires:\n");
        for (const { edge, requiringEntry, requiredEntry } of suggestions) {
          console.log(
            `  ${edge.fromId} ${edge.relationship} ${edge.toId} — add "requires: [${requiredEntry}]" to the "${requiringEntry}" entry in spec.config.yaml`,
          );
        }
      }

      if (conflicts.length > 0) {
        console.log("\n  ⚠ References that conflict with the requires chain:\n");
        for (const { edge, requiringEntry, requiredEntry } of conflicts) {
          console.log(
            `  ${edge.fromId} ${edge.relationship} ${edge.toId} — implies "${requiringEntry}" requires "${requiredEntry}", but that would create a cycle; review the reference or the config requires`,
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

import { defineCommand } from "citty";
import { loadConfig, buildGraph, GraphError } from "@sdx/core";
import { sharedArgs } from "../shared-args.js";

export default defineCommand({
  meta: { name: "graph", description: "Print the spec dependency graph" },
  args: { ...sharedArgs },
  async run({ args }) {
    let config;
    try {
      config = await loadConfig(undefined, process.cwd());
    } catch (err) {
      console.error(`\n  ✗ ${(err as Error).message}\n`);
      process.exit(1);
    }
    try {
      const graph = buildGraph(config);
      const sorted = graph.topologicalSort();
      if (args.format === "dot") {
        console.log("digraph specs {");
        for (const edge of graph.edges) console.log(`  "${edge.from}" -> "${edge.to}";`);
        console.log("}");
        return;
      }
      console.log("\n  Spec Dependency Graph:\n");
      for (const node of sorted) {
        const downstream = graph.getDownstream(node);
        const arrow = downstream.length > 0 ? ` → ${downstream.join(", ")}` : "";
        console.log(`  ${node}${arrow}`);
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

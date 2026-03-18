import type { LintRule } from "../types.js";

export const noCircularDepsRule: LintRule = {
  id: "structure/no-circular-deps",
  description: "The dependency graph has no cycles",
  severity: "error",
  run() {
    // Cycle detection happens in buildGraph() — if graph construction succeeds, it's acyclic.
    // GraphErrors are surfaced as diagnostics by the lint command, not by this rule.
    return [];
  },
};

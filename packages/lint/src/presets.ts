import type { LintRule } from "./types.js";
import { structureRules, allBuiltinRules } from "./rules/index.js";

export function getPreset(name: "minimal" | "recommended" | "strict"): LintRule[] {
  switch (name) {
    case "minimal":
      return structureRules;
    case "recommended":
      return allBuiltinRules;
    case "strict":
      return allBuiltinRules.map((rule) => ({ ...rule, severity: "error" as const }));
  }
}

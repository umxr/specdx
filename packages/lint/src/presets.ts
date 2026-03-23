import type { LintRule } from "./types.js";
import { structureRules, allBuiltinRules } from "./rules/index.js";

export function getPreset(name: string): LintRule[] {
  switch (name) {
    case "minimal":
      return structureRules;
    case "recommended":
      return allBuiltinRules;
    case "strict":
      return allBuiltinRules.map((rule) => ({ ...rule, severity: "error" as const }));
    default:
      throw new Error(
        `Unknown preset: "${name}". Use "minimal", "recommended", or "strict", or resolve external presets via resolvePreset() from @specdx/core.`,
      );
  }
}

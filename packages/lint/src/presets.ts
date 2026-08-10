import type { LintRule } from "./types.js";
import { structureRules, allBuiltinRules } from "./rules/index.js";

export function getPreset(name: string): LintRule[] {
  switch (name) {
    case "minimal":
      return structureRules;
    case "recommended":
      return allBuiltinRules;
    case "strict":
      // Promote warnings only. An info-class rule is an advisory the author
      // cannot satisfy by editing specs (ambiguity-score-ai fires whenever
      // ANTHROPIC_API_KEY is set), so promoting it would fail every suite
      // linted in an environment that carries the key.
      return allBuiltinRules.map((rule) =>
        rule.severity === "warn" ? { ...rule, severity: "error" as const } : rule,
      );
    default:
      throw new Error(
        `Unknown preset: "${name}". Use "minimal", "recommended", or "strict", or resolve external presets via resolvePreset() from @specdx/core.`,
      );
  }
}

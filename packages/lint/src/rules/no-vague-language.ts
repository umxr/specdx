import type { LintRule } from "../types.js";

const DEFAULT_VAGUE_PATTERNS = [
  "as appropriate",
  "handle edge cases",
  "as needed",
  "etc\\.",
  "TBD",
  "TODO",
  "and so on",
  "various",
  "somehow",
  "straightforward",
  "obviously",
  "simply",
  "just need to",
];

export const noVagueLanguageRule: LintRule = {
  id: "clarity/no-vague-language",
  description: "Flags known ambiguous phrases",
  severity: "warn",
  run(context) {
    if (!context.spec.content) return [];
    const diagnostics = [];
    for (const pattern of DEFAULT_VAGUE_PATTERNS) {
      const regex = new RegExp(`\\b${pattern}`, "gi");
      let match;
      while ((match = regex.exec(context.spec.content)) !== null) {
        diagnostics.push({
          ruleId: "clarity/no-vague-language",
          severity: "warn" as const,
          message: `Vague language: "${match[0]}"`,
          filePath: context.spec.filePath,
        });
      }
    }
    return diagnostics;
  },
};

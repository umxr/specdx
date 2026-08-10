import type { LintRule } from "../types.js";

export const ambiguityScoreAiRule: LintRule = {
  id: "clarity/ambiguity-score-ai",
  description: "AI-powered ambiguity detection (requires ANTHROPIC_API_KEY)",
  severity: "info",
  run(context) {
    if (!process.env["ANTHROPIC_API_KEY"]) return [];

    return [
      {
        ruleId: "clarity/ambiguity-score-ai",
        severity: "info" as const,
        message:
          "AI ambiguity analysis available — run `specdx check --ai` for LLM-powered ambiguity detection",
        filePath: context.spec.filePath,
      },
    ];
  },
};

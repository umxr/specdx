import type { LintRule } from "../types.js";

export const singleProjectContextRule: LintRule = {
  id: "structure/single-project-context",
  description: "Only one project-context spec should exist per suite",
  severity: "warn",
  run(context) {
    if (context.spec.frontmatter.type !== "project-context") return [];

    const contextSpecs = context.allSpecs.filter(
      (s) => s.frontmatter.type === "project-context",
    );

    if (contextSpecs.length > 1) {
      return [
        {
          ruleId: "structure/single-project-context",
          severity: "warn" as const,
          message: `Multiple project-context specs found (${contextSpecs.length}). Only one should exist per suite.`,
          filePath: context.spec.filePath,
        },
      ];
    }

    return [];
  },
};

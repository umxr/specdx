import type { LintRule } from "../types.js";

const EDGE_CASE_KEYWORDS = [
  "error",
  "invalid",
  "empty",
  "timeout",
  "fails",
  "failure",
  "boundary",
  "edge case",
  "null",
  "undefined",
  "reject",
  "unauthorized",
  "forbidden",
  "404",
  "500",
  "missing",
  "malformed",
  "overflow",
  "duplicate",
];

export const edgeCaseCoverageRule: LintRule = {
  id: "completeness/edge-case-coverage",
  description: "Flag user stories or test plans that don't mention error states or edge cases",
  severity: "warn",
  run(context) {
    const type = context.spec.frontmatter.type as string;
    if (type !== "user-story" && type !== "test-plan") return [];

    const content = context.spec.content.toLowerCase();
    const hasEdgeCases = EDGE_CASE_KEYWORDS.some((kw) => content.includes(kw));

    if (hasEdgeCases) return [];

    return [
      {
        ruleId: "completeness/edge-case-coverage",
        severity: "warn" as const,
        message:
          "No error states or edge cases mentioned. Consider adding error handling, boundary conditions, or failure mode scenarios.",
        filePath: context.spec.filePath,
      },
    ];
  },
};

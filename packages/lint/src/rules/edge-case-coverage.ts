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
  "missing",
  "malformed",
  "overflow",
  "duplicate",
  "graceful",
  "fall back",
  "fallback",
  "crash",
  "nonexistent",
  "corrupt",
  // Vocabulary that names a failure without using any of the words above.
  "conflict",
  "denied",
  "expired",
  "not found",
  "retry",
  "rate limit",
  "unavailable",
  "unprocessable",
];

/**
 * Any 4xx or 5xx status code counts as naming an error path.
 *
 * The list above held `404` and `500` and no other code, so a story whose only
 * error case was a 409 read as having no error handling at all -- changing that
 * one token to 404 silenced the warning with nothing else altered. Enumerating
 * codes was always going to be arbitrary; matching the class is not.
 */
const ERROR_STATUS_CODE = /\b[45]\d{2}\b/;

export const edgeCaseCoverageRule: LintRule = {
  id: "completeness/edge-case-coverage",
  description: "Flag user stories or test plans that don't mention error states or edge cases",
  severity: "warn",
  run(context) {
    const type = context.spec.frontmatter.type as string;
    if (type !== "user-story" && type !== "test-plan") return [];

    const content = context.spec.content.toLowerCase();
    const hasEdgeCases =
      EDGE_CASE_KEYWORDS.some((kw) => content.includes(kw)) || ERROR_STATUS_CODE.test(content);

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

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

/** The section a test plan is required to carry, and where its cases belong. */
const EDGE_CASE_SECTION = "edge cases";

/** Bodies that say "nothing has been written here yet". */
const PLACEHOLDER_BODIES = /^(todo|tbd|fixme|n\/a|na|none|xxx|\.{2,}|-|\*)$/i;

/** Bodies that answer the question with "there aren't any", which is not coverage. */
const DISCLAIMED_BODIES = /^(none|no|nothing|n\/a)\b[\s\S]{0,40}$/i;

/** Strip HTML comments, list bullets and separators to expose the real body. */
function meaningfulContent(content: string): string {
  return content
    .replace(/<!--[\s\S]*?-->/g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*[-*+]\s+/, "").trim())
    .filter((line) => line.length > 0 && !/^-{3,}$/.test(line))
    .join("\n")
    .trim();
}

export const edgeCaseCoverageRule: LintRule = {
  id: "completeness/edge-case-coverage",
  description: "Flag user stories or test plans that don't mention error states or edge cases",
  severity: "warn",
  run(context) {
    const type = context.spec.frontmatter.type as string;
    if (type !== "user-story" && type !== "test-plan") return [];

    // A test plan is *required* to carry an `## Edge Cases` heading, so scanning
    // the whole document for the words "edge case" matched the scaffolding and
    // nothing else -- the rule could never fire on the half of its scope that
    // has a dedicated home for the answer. Judge that section's body instead.
    const section = context.spec.parsedSections.find(
      (s) => s.heading.trim().toLowerCase() === EDGE_CASE_SECTION,
    );
    if (type === "test-plan" && section) {
      const body = meaningfulContent(section.content);
      const written =
        body !== "" && !PLACEHOLDER_BODIES.test(body) && !DISCLAIMED_BODIES.test(body);
      if (written) return [];

      return [
        {
          ruleId: "completeness/edge-case-coverage",
          severity: "warn" as const,
          message: `The "${section.heading}" section lists no cases — describe the boundary conditions and failure modes this plan covers, or the plan asserts only the happy path.`,
          filePath: context.spec.filePath,
          section: section.heading,
        },
      ];
    }

    // No dedicated section (a user story, or a test plan missing the heading —
    // `structure/required-sections` owns that): judge the document as a whole.
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

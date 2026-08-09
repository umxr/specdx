import type { LintRule } from "../types.js";

/**
 * Bodies that say "nothing has been written here yet".
 *
 * Matched against the whole section body, never as a substring: prose that
 * mentions a TODO is real content, a body that *is* "TODO" is not.
 */
const PLACEHOLDER_BODIES = /^(todo|tbd|fixme|n\/a|na|none|xxx|\.{2,}|-|\*)$/i;

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

/**
 * Flags sections that exist only as scaffolding.
 *
 * `structure/required-sections` checks that a heading is present, never that
 * anything was written under it. Without this rule a freshly scaffolded suite
 * of `<!-- placeholder -->` stubs lints clean, reports healthy, and is declared
 * ready for implementation -- the vacuous-pass failure mode, reached on a new
 * user's first command.
 *
 * Warning rather than error: an untouched scaffold should be visibly incomplete
 * without failing the very first `specdx lint` a user runs. `ready` enforces
 * the harder gate.
 */
export const noPlaceholderSectionsRule: LintRule = {
  id: "completeness/no-placeholder-sections",
  description: "Spec sections contain content, not scaffolding placeholders",
  severity: "warn",
  run(context) {
    return (
      context.spec.parsedSections
        // The preamble carries no heading and is not a section a user must fill.
        .filter((section) => section.heading !== "")
        .filter((section) => {
          const body = meaningfulContent(section.content);
          return body === "" || PLACEHOLDER_BODIES.test(body);
        })
        .map((section) => ({
          ruleId: "completeness/no-placeholder-sections",
          severity: "warn" as const,
          message: `Section "${section.heading}" is still a placeholder — write its content or remove the section`,
          filePath: context.spec.filePath,
          section: section.heading,
        }))
    );
  },
};

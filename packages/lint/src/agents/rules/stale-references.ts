import type { AgentRule, AgentLintContext, AgentRuleResult } from "../types.js";

/**
 * Paths an agent instruction file names must still exist.
 *
 * This is the failure mode that does active harm. A stale spec is merely out
 * of date; a CLAUDE.md that says "the config lives at `config/app.yaml`" after
 * that file moved sends every agent session to the wrong place, confidently.
 * specdx's own docs had exactly this rot — `other-platforms.md` named a path
 * and a command that did not exist.
 *
 * Extraction is deliberately conservative, because a false positive here costs
 * more than a miss. Only two things are treated as claims about the filesystem:
 *
 * - inline code spans that look like paths — `` `packages/cli/src/main.ts` ``
 * - relative Markdown link targets — `[the config](./spec.config.yaml)`
 *
 * Fenced code blocks are skipped entirely. They are full of illustrative and
 * hypothetical paths (`src/your-app.ts`), and flagging those would train users
 * to ignore this rule, which is worse than not having it.
 */

/** A path-shaped token: has a directory separator, or a known source extension. */
const PATH_SHAPED =
  /^(?:[\w.@-]+\/)+[\w.-]+$|^[\w.-]+\.(?:ts|tsx|js|jsx|mjs|cjs|json|md|ya?ml|toml|sh|py|rb|rs|go|java|css|html)$/;

/** Things that are path-shaped but are not claims about this repo. */
function isNotAFileClaim(candidate: string): boolean {
  return (
    candidate.includes("*") || // a glob describes a set, not a file
    candidate.includes("://") || // a URL
    candidate.startsWith("http") ||
    candidate.startsWith("@") || // an npm scope: @specdx/core
    candidate.startsWith("~") || // a home-relative path outside the repo
    candidate.startsWith("/") || // an absolute path outside the repo
    /^[A-Z_]+=/.test(candidate) // an env assignment
  );
}

/** Strip a leading `./`, and any trailing punctuation a sentence left behind. */
function normalise(candidate: string): string {
  return candidate.replace(/^\.\//, "").replace(/[.,;:)]+$/, "");
}

/**
 * Line indices that sit inside a fenced code block, so they can be skipped.
 * Handles ``` and ~~~ fences of any length.
 */
function fencedLines(lines: string[]): Set<number> {
  const fenced = new Set<number>();
  let fence: string | undefined;
  lines.forEach((line, index) => {
    const match = /^\s*(`{3,}|~{3,})/.exec(line);
    if (match) {
      if (fence === undefined) {
        fence = match[1]!;
        fenced.add(index);
        return;
      }
      // Only a fence of the same character closes the block.
      if (match[1]![0] === fence[0]) fence = undefined;
      fenced.add(index);
      return;
    }
    if (fence !== undefined) fenced.add(index);
  });
  return fenced;
}

export interface ExtractedReference {
  path: string;
  /** 1-indexed, to match how every other diagnostic in specdx reports lines. */
  line: number;
}

/** Exported for tests: the extraction is the part most likely to drift. */
export function extractReferences(lines: string[]): ExtractedReference[] {
  const skip = fencedLines(lines);
  const found: ExtractedReference[] = [];
  const seen = new Set<string>();

  lines.forEach((line, index) => {
    if (skip.has(index)) return;

    const candidates: string[] = [];
    // Inline code spans.
    for (const match of line.matchAll(/`([^`\n]+)`/g)) candidates.push(match[1]!);
    // Relative Markdown links. The leading `!` form (images) counts too.
    for (const match of line.matchAll(/\]\((?!https?:|#)([^)\s]+)\)/g)) candidates.push(match[1]!);

    for (const raw of candidates) {
      const candidate = normalise(raw.trim());
      if (!candidate || isNotAFileClaim(candidate)) continue;
      if (!PATH_SHAPED.test(candidate)) continue;
      if (seen.has(candidate)) continue;
      seen.add(candidate);
      found.push({ path: candidate, line: index + 1 });
    }
  });

  return found;
}

export const staleReferencesRule: AgentRule = {
  id: "agents/stale-references",
  description: "Paths named by an agent instruction file must exist",
  severity: "warn",

  run(context: AgentLintContext): AgentRuleResult {
    const { file, exists } = context;
    const references = extractReferences(file.lines);

    // Honest about scope: a file naming no paths had nothing checked, and
    // saying so beats letting a clean run imply the references were verified.
    // Same contract `check` was forced into — "not assessed" is not "passing".
    if (references.length === 0) {
      return {
        diagnostics: [],
        assessed: false,
        notAssessedReason: `${file.relativePath} names no file paths, so none were checked for staleness.`,
      };
    }

    return {
      diagnostics: references
        .filter((reference) => !exists(reference.path))
        .map((reference) => ({
          ruleId: "agents/stale-references",
          severity: this.severity,
          message: `${file.relativePath} refers to "${reference.path}", which does not exist. An agent told to look there will not find it.`,
          filePath: file.filePath,
          line: reference.line,
        })),
    };
  },
};

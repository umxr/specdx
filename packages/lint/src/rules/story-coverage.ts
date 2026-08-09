import type { LintRule } from "../types.js";
import type { ParsedSpec } from "@specdx/core";

/** Words carrying no signal about what a feature is. */
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "to",
  "for",
  "with",
  "its",
  "it",
  "in",
  "on",
  "at",
  "by",
  "from",
  "into",
  "every",
  "each",
  "that",
  "this",
  "be",
  "is",
  "are",
  "as",
  "can",
  "will",
  "must",
  "so",
  "their",
  "them",
  "when",
  "which",
  "who",
]);

/** Share of a feature's words a story must echo to count as covering it. */
const OVERLAP_THRESHOLD = 0.5;

/** Lower bar for a story that explicitly references the PRD. */
const REFERENCED_THRESHOLD = 0.34;

function tokenise(text: string): Set<string> {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    // Crude singularisation, so "actions" matches "action".
    .map((w) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
  return new Set(words);
}

function extractFeatureSection(content: string): string | null {
  // Scanned line by line rather than with one regex: `$` and `\Z` behave
  // differently enough across multiline modes to make the regex form a trap.
  const lines = content.split("\n");
  const start = lines.findIndex((l) => /^##\s+Features\s*$/.test(l.trim()));
  if (start === -1) return null;
  const body: string[] = [];
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s/.test(lines[i]!)) break;
    body.push(lines[i]!);
  }
  return body.join("\n");
}

/**
 * Feature descriptions from a PRD's Features section.
 *
 * Previously only `- **F1**: text` was recognised, so a PRD written any other
 * way parsed to zero features and the rule passed vacuously -- which `ready`
 * then reported as "all features have stories" over an empty set.
 */
export function parseFeatures(content: string): string[] {
  return parseFeatureEntries(content).map((f) => f.text);
}

/** A PRD feature, with its `F<N>` number when the author gave it one. */
export interface FeatureEntry {
  /** The feature description, with any ID prefix removed. */
  text: string;
  /** The `N` from `**F<N>**:`, when present. */
  num?: string;
}

/**
 * The single source of truth for what counts as a feature in a PRD.
 *
 * `generate story` used to carry its own regex requiring `**F<N>**:`, so on a
 * PRD without those IDs the lint rule reported three features and the generator
 * reported none -- two commands in the same suite contradicting each other over
 * one file. Anything that needs to know what a PRD's features are calls this.
 */
export function parseFeatureEntries(content: string): FeatureEntry[] {
  const section = extractFeatureSection(content);
  if (section === null) return [];

  /** `**F1**:`, `F1:`, `F1 -` — an optional feature ID prefix. */
  const ID_PREFIX = /^\*{0,2}F(\d+)\*{0,2}\s*[:.-]\s*/i;

  const features: FeatureEntry[] = [];
  for (const rawLine of section.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    // A bullet is a feature whether or not it carries an ID. A non-bullet line
    // counts only when it does, so ordinary prose in the section is not
    // mistaken for a feature list.
    const text = bullet ? (bullet[1] ?? "").trim() : ID_PREFIX.test(line) ? line : "";
    if (!text) continue;

    const idMatch = ID_PREFIX.exec(text);
    const stripped = text.replace(ID_PREFIX, "").trim();
    if (stripped) features.push({ text: stripped, num: idMatch?.[1] });
  }
  return features;
}

function overlap(featureTokens: Set<string>, storyTokens: Set<string>): number {
  if (featureTokens.size === 0) return 0;
  let shared = 0;
  for (const token of featureTokens) if (storyTokens.has(token)) shared++;
  return shared / featureTokens.size;
}

function referencesSpec(story: ParsedSpec, specId: unknown): boolean {
  const refs = story.frontmatter.references;
  if (!Array.isArray(refs)) return false;
  return refs.some((r) => (r as { id?: unknown })?.id === specId);
}

/**
 * Features from `features` that no story in `stories` appears to cover.
 *
 * Exported so the linter and `generate story` share one definition of
 * "covered". They had two, which is why the rule warned about features that
 * had stories while the generator re-stubbed features that already had them.
 */
export function uncoveredFeatures(
  features: string[],
  stories: ParsedSpec[],
  prdId: unknown,
): string[] {
  const scored = stories.map((story) => ({
    tokens: tokenise(`${String(story.frontmatter.title ?? "")} ${story.content}`),
    threshold: referencesSpec(story, prdId) ? REFERENCED_THRESHOLD : OVERLAP_THRESHOLD,
  }));

  return features.filter((feature) => {
    const featureTokens = tokenise(feature);
    return !scored.some((s) => overlap(featureTokens, s.tokens) >= s.threshold);
  });
}

export const storyCoverageRule: LintRule = {
  id: "completeness/story-coverage",
  description: "Every feature listed in a PRD has at least one corresponding user story",
  severity: "warn",
  run(context) {
    if (context.spec.frontmatter.type !== "prd") return [];

    const features = parseFeatures(context.spec.content);
    if (features.length === 0) return [];

    const stories = context.allSpecs.filter((s) => s.frontmatter.type === "user-story");

    return uncoveredFeatures(features, stories, context.spec.frontmatter.id).map((feature) => ({
      ruleId: "completeness/story-coverage",
      severity: "warn" as const,
      message: `Feature "${feature}" has no corresponding user story`,
      filePath: context.spec.filePath,
    }));
  },
};

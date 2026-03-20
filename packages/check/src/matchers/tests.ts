import type { Finding, SpecTestCase, ExtractedTest } from "../types.js";

/** Jaccard similarity between two strings. Normalises to lowercase words. */
function jaccard(a: string, b: string): number {
  const wordsA = new Set(
    a
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter(Boolean),
  );
  const wordsB = new Set(
    b
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter(Boolean),
  );
  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);
  if (union.size === 0) return 0;
  return intersection.size / union.size;
}

const JACCARD_THRESHOLD = 0.4;

/**
 * Match spec test cases against extracted code tests using Jaccard similarity.
 *
 * - Spec cases that have a code-test match above the threshold are considered covered.
 * - Unmatched spec cases produce a `missing` / `warn` Finding.
 * - Extra code tests (not matched to any spec case) are not reported.
 */
export function matchTests(
  specCases: SpecTestCase[],
  codeTests: ExtractedTest[],
  specId: string,
): Finding[] {
  const findings: Finding[] = [];

  for (const specCase of specCases) {
    let bestScore = 0;
    let bestMatch: ExtractedTest | undefined;

    for (const codeTest of codeTests) {
      const score = jaccard(specCase.description, codeTest.description);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = codeTest;
      }
    }

    if (bestScore < JACCARD_THRESHOLD || !bestMatch) {
      findings.push({
        type: "missing",
        category: "test",
        specId,
        specSection: specCase.section,
        expected: specCase.description,
        severity: "warn",
        suggestion: `Add a test matching: "${specCase.description}"`,
      });
    }
  }

  return findings;
}

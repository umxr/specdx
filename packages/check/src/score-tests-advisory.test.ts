import { computeScore } from "./score.js";
import type { Finding } from "./types.js";

function missingTest(): Finding {
  return {
    type: "missing",
    category: "test",
    specId: "tp-001",
    expected: "rejects a request with an expired token",
    severity: "warn",
  };
}

describe("computeScore treats test-case matching as advisory", () => {
  // Jaccard similarity at 0.4 scores "rejects a request with an expired token"
  // against `returns 401 when the token has expired` at 0.167 (reported
  // missing) and "creates an invoice" against `creates an invoice draft` at
  // 0.750 (reported covered). It measures shared vocabulary, not shared
  // meaning, so it cannot move a number anyone acts on.

  it("does not let an unmatched test case reduce the overall score", () => {
    const withRoutesOnly = computeScore([], { routes: 4, types: 0, tests: 0, artifacts: 0 });
    const withUnmatchedTests = computeScore([missingTest(), missingTest()], {
      routes: 4,
      types: 0,
      tests: 2,
      artifacts: 0,
    });

    expect(withUnmatchedTests.overall).toBe(withRoutesOnly.overall);
    expect(withUnmatchedTests.overall).toBe(100);
  });

  it("still reports how many test cases matched, for the record", () => {
    const score = computeScore([missingTest()], { routes: 0, types: 0, tests: 3, artifacts: 0 });

    expect(score.byCategory.tests).toEqual({ matched: 2, total: 3 });
  });

  it("does not call a suite assessed when test cases were the only surface", () => {
    const score = computeScore([], { routes: 0, types: 0, tests: 5, artifacts: 0 });

    expect(score.assessed).toBe(false);
  });
});

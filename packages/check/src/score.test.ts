import { describe, it, expect } from "vitest";
import { computeScore } from "./score.js";
import type { Finding } from "./types.js";

describe("computeScore", () => {
  it("computes 100% when no findings", () => {
    const score = computeScore([], { routes: 5, types: 10, tests: 8, artifacts: 0 });
    expect(score.overall).toBe(100);
    expect(score.assessed).toBe(true);
  });

  it("computes correct percentage with missing items", () => {
    const findings: Finding[] = [
      { type: "missing", category: "route", specId: "x", expected: "GET /a", severity: "error" },
      { type: "missing", category: "route", specId: "x", expected: "GET /b", severity: "error" },
      { type: "missing", category: "type", specId: "x", expected: "field x", severity: "warn" },
    ];
    const score = computeScore(findings, { routes: 5, types: 10, tests: 8, artifacts: 0 });
    expect(score.overall).toBe(Math.round(((5 - 2 + 10 - 1 + 8) / (5 + 10 + 8)) * 100));
    expect(score.byCategory["routes"]).toEqual({ matched: 3, total: 5 });
    expect(score.byCategory["types"]).toEqual({ matched: 9, total: 10 });
    expect(score.byCategory["tests"]).toEqual({ matched: 8, total: 8 });
  });

  it("ignores extra and info findings in score", () => {
    const findings: Finding[] = [
      { type: "extra", category: "route", specId: "x", expected: "", severity: "info" },
    ];
    const score = computeScore(findings, { routes: 5, types: 0, tests: 0, artifacts: 0 });
    expect(score.overall).toBe(100);
  });

  it("marks zero totals as not assessed instead of a vacuous 100% (issue #6)", () => {
    const score = computeScore([], { routes: 0, types: 0, tests: 0, artifacts: 0 });
    expect(score.assessed).toBe(false);
    expect(score.overall).toBe(0);
  });

  it("declared artifacts alone make the score assessed (issue #15)", () => {
    const findings: Finding[] = [
      {
        type: "missing",
        category: "artifact",
        specId: "x",
        expected: "file a.ts",
        severity: "error",
      },
    ];
    const score = computeScore(findings, { routes: 0, types: 0, tests: 0, artifacts: 4 });
    expect(score.assessed).toBe(true);
    expect(score.overall).toBe(75);
    expect(score.byCategory["artifacts"]).toEqual({ matched: 3, total: 4 });
  });
});

import { describe, it, expect } from "vitest";
import { edgeCaseCoverageRule } from "./edge-case-coverage.js";
import type { ParsedSpec } from "@specdx/core";

const makeSpec = (type: string, content: string): ParsedSpec => ({
  filePath: "specs/test.md",
  frontmatter: {
    id: "test",
    type,
    title: "Test",
    status: "draft",
    version: "1.0",
    created: "2026-01-01",
    authors: ["dev"],
  },
  content,
  sections: [],
  parsedSections: [],
  valid: true,
  validationErrors: null,
});

describe("edgeCaseCoverageRule", () => {
  it("warns when user-story has no error/edge case keywords", () => {
    const spec = makeSpec(
      "user-story",
      "## Description\n\nUser can log in.\n\n## Acceptance Criteria\n\n- User enters credentials\n- User sees dashboard",
    );
    const result = edgeCaseCoverageRule.run({ spec, allSpecs: [spec] });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.message).toContain("edge case");
  });

  it("passes when user-story mentions error handling", () => {
    const spec = makeSpec(
      "user-story",
      "## Description\n\nUser can log in.\n\n## Acceptance Criteria\n\n- Invalid credentials show error message\n- Empty email field shows validation error",
    );
    const result = edgeCaseCoverageRule.run({ spec, allSpecs: [spec] });
    expect(result).toHaveLength(0);
  });

  it("passes when user-story describes graceful degradation without classic error keywords", () => {
    const spec = makeSpec(
      "user-story",
      "## Description\n\nSkill loads spec context.\n\n## Acceptance Criteria\n\n- Skills fall back gracefully with a clear message when no config exists\n- The process does not crash on unexpected input",
    );
    const result = edgeCaseCoverageRule.run({ spec, allSpecs: [spec] });
    expect(result).toHaveLength(0);
  });

  it("warns when test-plan has no edge case coverage", () => {
    const spec = makeSpec("test-plan", "## Test Cases\n\n- User can log in\n- User can sign up");
    const result = edgeCaseCoverageRule.run({ spec, allSpecs: [spec] });
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("passes for test-plan with edge cases", () => {
    const spec = makeSpec(
      "test-plan",
      "## Test Cases\n\n- User can log in\n- Invalid password returns 401\n- Empty input shows boundary error",
    );
    const result = edgeCaseCoverageRule.run({ spec, allSpecs: [spec] });
    expect(result).toHaveLength(0);
  });

  it("skips non-applicable spec types", () => {
    const spec = makeSpec("prd", "## Features\n\n- **F1**: Login");
    const result = edgeCaseCoverageRule.run({ spec, allSpecs: [spec] });
    expect(result).toHaveLength(0);
  });
});

describe("edge-case-coverage — error status codes", () => {
  // The keyword list held `404` and `500` and no other code, so a story whose
  // error path was a 409 read as having no error handling at all. Changing that
  // one token to 404, with nothing else altered, silenced the warning.
  const base =
    "## Description\n\nFinance voids an invoice.\n\n## Acceptance Criteria\n\n" +
    "- Given an open invoice, when I void it, then its status becomes void.\n" +
    "- Given a paid invoice, when I void it, then the response is ";

  const run = (body: string) => {
    const spec = makeSpec("user-story", body);
    return edgeCaseCoverageRule.run({ spec, allSpecs: [spec] });
  };

  it("accepts any 4xx as naming an error path", () => {
    for (const code of ["400", "401", "403", "409", "422", "429"]) {
      expect(run(`${base}${code}.`), `status ${code}`).toEqual([]);
    }
  });

  it("accepts any 5xx as naming an error path", () => {
    for (const code of ["500", "502", "503"]) {
      expect(run(`${base}${code}.`), `status ${code}`).toEqual([]);
    }
  });

  it("accepts vocabulary that names a failure without a status code", () => {
    for (const word of ["a conflict", "denied", "expired", "unavailable"]) {
      expect(run(`${base}${word}.`), word).toEqual([]);
    }
  });

  it("still warns when no failure path is described at all", () => {
    const body =
      "## Description\n\nFinance lists invoices.\n\n## Acceptance Criteria\n\n" +
      "- Given invoices exist, when I list them, then each one is returned.";
    expect(run(body)).toHaveLength(1);
  });

  it("does not treat an ordinary number as a status code", () => {
    const body =
      "## Description\n\nFinance lists invoices.\n\n## Acceptance Criteria\n\n" +
      "- The list returns up to 250 rows per page, sorted by due date.";
    expect(run(body)).toHaveLength(1);
  });
});

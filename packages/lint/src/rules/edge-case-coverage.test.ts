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

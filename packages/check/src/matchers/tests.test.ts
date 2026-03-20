import { describe, it, expect } from "vitest";
import { matchTests } from "./tests.js";
import type { SpecTestCase, ExtractedTest } from "../types.js";

describe("matchTests", () => {
  const specCases: SpecTestCase[] = [
    { description: "Config loader: finds config, handles missing config" },
    { description: "should create a new user" },
    { description: "should reject invalid email addresses" },
    { description: "endpoint returns 404 for missing resources" },
  ];

  const codeTests: ExtractedTest[] = [
    { description: "should create a new user", file: "user.test.ts", line: 5 },
    { description: "should reject invalid email", file: "user.test.ts", line: 10 },
    {
      description: "Config loader finds config and validates structure",
      file: "config.test.ts",
      line: 3,
    },
  ];

  it("finds covered test cases (matching spec to code)", () => {
    const findings = matchTests(specCases, codeTests, "test-plan");
    // "should create a new user" should match exactly
    // "should reject invalid email addresses" should fuzzy-match "should reject invalid email"
    const missing = findings.filter((f) => f.type === "missing");
    // "endpoint returns 404 for missing resources" has no match
    expect(missing.length).toBeGreaterThanOrEqual(1);
    expect(missing.some((f) => f.expected.includes("404"))).toBe(true);
  });

  it("marks unmatched spec cases as warn severity", () => {
    const findings = matchTests(specCases, codeTests, "test-plan");
    const missing = findings.filter((f) => f.type === "missing");
    for (const f of missing) {
      expect(f.severity).toBe("warn");
    }
  });

  it("returns no findings when all spec cases are covered", () => {
    const simpleSpec: SpecTestCase[] = [
      { description: "should create a new user" },
      { description: "should reject invalid email" },
    ];
    const findings = matchTests(simpleSpec, codeTests, "test-plan");
    expect(findings).toHaveLength(0);
  });

  it("returns all spec cases as missing when codeTests is empty", () => {
    const findings = matchTests(specCases, [], "test-plan");
    expect(findings).toHaveLength(specCases.length);
    for (const f of findings) {
      expect(f.type).toBe("missing");
      expect(f.severity).toBe("warn");
    }
  });

  it("sets category to test on all findings", () => {
    const findings = matchTests(specCases, [], "test-plan");
    for (const f of findings) {
      expect(f.category).toBe("test");
    }
  });

  it("sets specId on all findings", () => {
    const findings = matchTests(specCases, [], "my-spec-id");
    for (const f of findings) {
      expect(f.specId).toBe("my-spec-id");
    }
  });
});

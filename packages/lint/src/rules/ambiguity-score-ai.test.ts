import { describe, it, expect } from "vitest";
import { ambiguityScoreAiRule } from "./ambiguity-score-ai.js";
import type { ParsedSpec } from "@specdx/core";

const makeSpec = (content: string): ParsedSpec => ({
  filePath: "specs/test.md",
  frontmatter: {
    id: "test",
    type: "prd",
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

describe("ambiguityScoreAiRule", () => {
  it("returns empty when no API key is set", () => {
    delete process.env["ANTHROPIC_API_KEY"];
    const spec = makeSpec("Some content.");
    const result = ambiguityScoreAiRule.run({ spec, allSpecs: [spec] });
    expect(result).toHaveLength(0);
  });

  it("returns info diagnostic when API key is set", () => {
    process.env["ANTHROPIC_API_KEY"] = "test-key";
    const spec = makeSpec("Some content.");
    const result = ambiguityScoreAiRule.run({ spec, allSpecs: [spec] });
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe("info");
    expect(result[0]!.message).toContain("sdx check --ai");
    delete process.env["ANTHROPIC_API_KEY"];
  });
});

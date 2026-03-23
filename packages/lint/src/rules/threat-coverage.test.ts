import { describe, it, expect } from "vitest";
import { threatCoverageRule } from "./threat-coverage.js";
import type { ParsedSpec } from "@specdx/core";

const makeSpec = (id: string, type: string, content: string, sections: string[] = []): ParsedSpec => ({
  filePath: `specs/${id}.md`,
  frontmatter: { id, type, title: id, status: "draft", version: "1.0", created: "2026-01-01", authors: ["dev"] },
  content,
  sections,
  parsedSections: [],
  valid: true,
  validationErrors: null,
});

describe("threatCoverageRule", () => {
  it("warns when threats exist but technical design doesn't address them", () => {
    const threatSpec = makeSpec("security", "prd", "## Threats\n\n- SQL injection via user input\n- XSS in comment fields", ["Threats"]);
    const techSpec = makeSpec("tech", "technical-design", "## Architecture\n\nStandard MVC pattern.", ["Architecture"]);
    const result = threatCoverageRule.run({ spec: techSpec, allSpecs: [threatSpec, techSpec] });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.message).toContain("threat");
  });

  it("passes when technical design addresses threats", () => {
    const threatSpec = makeSpec("security", "prd", "## Threats\n\n- SQL injection via user input", ["Threats"]);
    const techSpec = makeSpec("tech", "technical-design", "## Architecture\n\nAll queries use parameterized statements to prevent SQL injection.", ["Architecture"]);
    const result = threatCoverageRule.run({ spec: techSpec, allSpecs: [threatSpec, techSpec] });
    expect(result).toHaveLength(0);
  });

  it("skips when no threats section exists in any spec", () => {
    const spec = makeSpec("tech", "technical-design", "## Architecture\n\nBasic design.", ["Architecture"]);
    const result = threatCoverageRule.run({ spec, allSpecs: [spec] });
    expect(result).toHaveLength(0);
  });

  it("only runs on technical-design specs", () => {
    const spec = makeSpec("prd", "prd", "## Threats\n\n- SQL injection", ["Threats"]);
    const result = threatCoverageRule.run({ spec, allSpecs: [spec] });
    expect(result).toHaveLength(0);
  });
});

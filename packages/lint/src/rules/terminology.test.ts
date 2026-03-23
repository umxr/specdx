import { describe, it, expect } from "vitest";
import { terminologyRule } from "./terminology.js";
import type { ParsedSpec } from "@specdx/core";

const makeSpec = (id: string, content: string, type = "prd"): ParsedSpec => ({
  filePath: `specs/${id}.md`,
  frontmatter: {
    id,
    type,
    title: id,
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

describe("terminologyRule", () => {
  it("warns when similar terms are used across specs", () => {
    const specs = [
      makeSpec("prd", "The user profile allows editing personal details."),
      makeSpec(
        "tech",
        "The UserProfile component renders the user-profile page.",
        "technical-design",
      ),
    ];
    const result = terminologyRule.run({ spec: specs[0]!, allSpecs: specs });
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result[0]!.message).toContain("terminology");
  });

  it("passes when terminology is consistent", () => {
    const specs = [
      makeSpec("prd", "The user profile allows editing."),
      makeSpec("tech", "The user profile component renders data.", "technical-design"),
    ];
    const result = terminologyRule.run({ spec: specs[0]!, allSpecs: specs });
    expect(result).toHaveLength(0);
  });

  it("only runs on the first spec to avoid duplicate warnings", () => {
    const specs = [
      makeSpec("prd", "user profile editing"),
      makeSpec("tech", "UserProfile component", "technical-design"),
    ];
    const result = terminologyRule.run({ spec: specs[1]!, allSpecs: specs });
    expect(result).toHaveLength(0);
  });
});

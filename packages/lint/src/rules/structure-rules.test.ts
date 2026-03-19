import { describe, it, expect } from "vitest";
import { validFrontmatterRule } from "./valid-frontmatter.js";
import { requiredSectionsRule } from "./required-sections.js";
import { validReferencesRule } from "./valid-references.js";
import { noCircularDepsRule } from "./no-circular-deps.js";
import type { LintContext } from "../types.js";
import type { ParsedSpec } from "@specdx/core";
import type { ErrorObject } from "ajv";

function makeSpec(overrides: Partial<ParsedSpec> = {}): ParsedSpec {
  return {
    filePath: "specs/prd.md",
    frontmatter: {
      id: "prd-001",
      type: "prd",
      title: "Test",
      status: "draft",
      version: "1.0",
      created: "2026-01-01",
      authors: ["dev"],
    },
    content: "",
    sections: ["Problem Statement", "Goals", "Non-Goals", "Features", "Success Criteria"],
    parsedSections: [],
    valid: true,
    validationErrors: null,
    ...overrides,
  };
}

function makeContext(spec: ParsedSpec, allSpecs?: ParsedSpec[]): LintContext {
  return { spec, allSpecs: allSpecs ?? [spec] };
}

describe("valid-frontmatter", () => {
  it("passes for valid frontmatter", () => {
    expect(validFrontmatterRule.run(makeContext(makeSpec()))).toHaveLength(0);
  });

  it("reports errors for invalid frontmatter", () => {
    const spec = makeSpec({
      valid: false,
      validationErrors: [{ message: "missing id" } as ErrorObject],
    });
    const diags = validFrontmatterRule.run(makeContext(spec));
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.severity).toBe("error");
  });
});

describe("required-sections", () => {
  it("passes when all required sections are present", () => {
    expect(requiredSectionsRule.run(makeContext(makeSpec()))).toHaveLength(0);
  });

  it("reports missing sections", () => {
    const spec = makeSpec({ sections: ["Problem Statement"] });
    const diags = requiredSectionsRule.run(makeContext(spec));
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.message).toContain("Goals");
  });

  it("skips YAML specs", () => {
    const spec = makeSpec({ filePath: "specs/story.yaml", sections: [], content: "" });
    expect(requiredSectionsRule.run(makeContext(spec))).toHaveLength(0);
  });
});

describe("valid-references", () => {
  it("passes when all references exist", () => {
    const prd = makeSpec({
      frontmatter: {
        id: "prd-001",
        type: "prd",
        title: "PRD",
        status: "draft",
        version: "1.0",
        created: "2026-01-01",
        authors: ["dev"],
        references: [{ id: "tech-001", relationship: "implemented-by" as const }],
      },
    });
    const tech = makeSpec({
      filePath: "specs/tech.md",
      frontmatter: {
        id: "tech-001",
        type: "technical-design",
        title: "Tech",
        status: "draft",
        version: "1.0",
        created: "2026-01-01",
        authors: ["dev"],
      },
    });
    expect(validReferencesRule.run(makeContext(prd, [prd, tech]))).toHaveLength(0);
  });

  it("reports broken references", () => {
    const prd = makeSpec({
      frontmatter: {
        id: "prd-001",
        type: "prd",
        title: "PRD",
        status: "draft",
        version: "1.0",
        created: "2026-01-01",
        authors: ["dev"],
        references: [{ id: "nonexistent", relationship: "implemented-by" as const }],
      },
    });
    const diags = validReferencesRule.run(makeContext(prd, [prd]));
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.message).toContain("nonexistent");
  });
});

describe("no-circular-deps", () => {
  it("returns empty (cycle detection is in buildGraph)", () => {
    expect(noCircularDepsRule.run(makeContext(makeSpec()))).toHaveLength(0);
  });
});

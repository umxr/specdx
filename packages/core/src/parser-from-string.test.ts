import { parseSpecFromString } from "./parser.js";

describe("parseSpecFromString", () => {
  const validPrd = `---
id: prd
type: prd
title: "Test PRD"
status: draft
version: "0.1"
created: "2026-01-01"
authors: ["test"]
---

## Problem Statement

Test problem.

## Goals

Test goals.
`;

  it("parses valid markdown spec from string", async () => {
    const result = await parseSpecFromString(validPrd, "specs/prd.md");
    expect(result.filePath).toBe("specs/prd.md");
    expect(result.frontmatter.id).toBe("prd");
    expect(result.frontmatter.type).toBe("prd");
    expect(result.sections).toContain("Problem Statement");
    expect(result.sections).toContain("Goals");
    expect(result.valid).toBe(true);
  });

  it("returns parsedSections with token counts", async () => {
    const result = await parseSpecFromString(validPrd, "specs/prd.md");
    expect(result.parsedSections.length).toBeGreaterThan(0);
    const firstSection = result.parsedSections[0];
    expect(firstSection).toBeDefined();
    expect(firstSection!.heading).toBe("Problem Statement");
    expect(firstSection!.tokens).toBeGreaterThan(0);
  });

  it("reports validation errors for invalid spec type", async () => {
    const invalid = `---
id: bad
type: invalid-type
title: "Bad"
status: draft
version: "0.1"
created: "2026-01-01"
authors: ["test"]
---

## Content

Some content.
`;
    const result = await parseSpecFromString(invalid, "specs/bad.md");
    expect(result.valid).toBe(false);
  });
});

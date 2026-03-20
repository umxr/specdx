import { parseSpecFromString } from "@specdx/core";
import { diffSpecs } from "./diff-specs.js";

const basePrd = `---
id: prd
type: prd
title: "Test PRD"
status: draft
version: "0.1"
created: "2026-01-01"
authors: ["alice"]
---

## Problem Statement

Original problem.

## Goals

Original goals.
`;

describe("diffSpecs", () => {
  it("returns empty diff for identical specs", async () => {
    const before = await parseSpecFromString(basePrd, "specs/prd.md");
    const after = await parseSpecFromString(basePrd, "specs/prd.md");
    const diff = diffSpecs(before, after);
    expect(diff.frontmatter).toHaveLength(0);
    expect(diff.sections).toHaveLength(0);
    expect(diff.specId).toBe("prd");
  });

  it("detects modified frontmatter field", async () => {
    const modified = basePrd.replace("status: draft", "status: approved");
    const before = await parseSpecFromString(basePrd, "specs/prd.md");
    const after = await parseSpecFromString(modified, "specs/prd.md");
    const diff = diffSpecs(before, after);
    const statusChange = diff.frontmatter.find((f) => f.field === "status");
    expect(statusChange).toBeDefined();
    expect(statusChange!.type).toBe("modified");
    expect(statusChange!.before).toBe("draft");
    expect(statusChange!.after).toBe("approved");
  });

  it("detects added frontmatter field", async () => {
    const modified = basePrd.replace('authors: ["alice"]', 'authors: ["alice"]\ntags: ["auth"]');
    const before = await parseSpecFromString(basePrd, "specs/prd.md");
    const after = await parseSpecFromString(modified, "specs/prd.md");
    const diff = diffSpecs(before, after);
    const tagsChange = diff.frontmatter.find((f) => f.field === "tags");
    expect(tagsChange).toBeDefined();
    expect(tagsChange!.type).toBe("added");
  });

  it("detects removed frontmatter field", async () => {
    const withTags = basePrd.replace('authors: ["alice"]', 'authors: ["alice"]\ntags: ["auth"]');
    const before = await parseSpecFromString(withTags, "specs/prd.md");
    const after = await parseSpecFromString(basePrd, "specs/prd.md");
    const diff = diffSpecs(before, after);
    const tagsChange = diff.frontmatter.find((f) => f.field === "tags");
    expect(tagsChange).toBeDefined();
    expect(tagsChange!.type).toBe("removed");
  });

  it("detects added section", async () => {
    const modified = basePrd + "\n## Non-Goals\n\nNo non-goals.\n";
    const before = await parseSpecFromString(basePrd, "specs/prd.md");
    const after = await parseSpecFromString(modified, "specs/prd.md");
    const diff = diffSpecs(before, after);
    const added = diff.sections.find((s) => s.heading === "Non-Goals");
    expect(added).toBeDefined();
    expect(added!.type).toBe("added");
  });

  it("detects removed section", async () => {
    const withExtra = basePrd + "\n## Non-Goals\n\nNo non-goals.\n";
    const before = await parseSpecFromString(withExtra, "specs/prd.md");
    const after = await parseSpecFromString(basePrd, "specs/prd.md");
    const diff = diffSpecs(before, after);
    const removed = diff.sections.find((s) => s.heading === "Non-Goals");
    expect(removed).toBeDefined();
    expect(removed!.type).toBe("removed");
  });

  it("detects modified section content", async () => {
    const modified = basePrd.replace("Original problem.", "Updated problem statement.");
    const before = await parseSpecFromString(basePrd, "specs/prd.md");
    const after = await parseSpecFromString(modified, "specs/prd.md");
    const diff = diffSpecs(before, after);
    const changed = diff.sections.find((s) => s.heading === "Problem Statement");
    expect(changed).toBeDefined();
    expect(changed!.type).toBe("modified");
    expect(changed!.contentDiff).toBeDefined();
  });

  it("generates a summary string", async () => {
    const modified = basePrd.replace("status: draft", "status: approved");
    const before = await parseSpecFromString(basePrd, "specs/prd.md");
    const after = await parseSpecFromString(modified, "specs/prd.md");
    const diff = diffSpecs(before, after);
    expect(diff.summary.length).toBeGreaterThan(0);
  });
});

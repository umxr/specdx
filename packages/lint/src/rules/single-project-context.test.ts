import { describe, it, expect } from "vitest";
import { singleProjectContextRule } from "./single-project-context.js";
import type { ParsedSpec } from "@specdx/core";

const makeSpec = (id: string, type: string): ParsedSpec => ({
  filePath: `specs/${id}.md`,
  frontmatter: { id, type, title: id, status: "draft", version: "1.0", created: "2026-01-01", authors: ["dev"] },
  content: "",
  sections: [],
  parsedSections: [],
  valid: true,
  validationErrors: null,
});

describe("singleProjectContextRule", () => {
  it("passes when there is exactly one project-context", () => {
    const specs = [makeSpec("ctx", "project-context"), makeSpec("prd", "prd")];
    const result = singleProjectContextRule.run({
      spec: specs[0]!,
      allSpecs: specs,
    });
    expect(result).toHaveLength(0);
  });

  it("warns when there are multiple project-context specs", () => {
    const specs = [
      makeSpec("ctx-1", "project-context"),
      makeSpec("ctx-2", "project-context"),
      makeSpec("prd", "prd"),
    ];
    const result = singleProjectContextRule.run({
      spec: specs[0]!,
      allSpecs: specs,
    });
    expect(result).toHaveLength(1);
    expect(result[0]!.severity).toBe("warn");
    expect(result[0]!.message).toContain("project-context");
  });

  it("passes when there are no project-context specs", () => {
    const specs = [makeSpec("prd", "prd")];
    const result = singleProjectContextRule.run({
      spec: specs[0]!,
      allSpecs: specs,
    });
    expect(result).toHaveLength(0);
  });

  it("only runs on project-context specs (skips other types)", () => {
    const specs = [
      makeSpec("ctx-1", "project-context"),
      makeSpec("ctx-2", "project-context"),
      makeSpec("prd", "prd"),
    ];
    const result = singleProjectContextRule.run({
      spec: specs[2]!,
      allSpecs: specs,
    });
    expect(result).toHaveLength(0);
  });
});

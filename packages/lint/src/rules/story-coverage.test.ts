import { describe, it, expect } from "vitest";
import { storyCoverageRule, parseFeatures } from "./story-coverage.js";
import type { LintContext } from "../types.js";
import type { ParsedSpec } from "@specdx/core";

function spec(overrides: Partial<ParsedSpec> & { id: string; type: string }): ParsedSpec {
  const { id, type, ...rest } = overrides;
  return {
    filePath: `specs/${id}.md`,
    frontmatter: {
      id,
      type,
      title: id,
      status: "approved",
      version: "1.0",
      created: "2026-01-01",
      authors: ["dev"],
    },
    content: "",
    sections: [],
    parsedSections: [],
    valid: true,
    validationErrors: null,
    ...rest,
  } as ParsedSpec;
}

function prd(features: string[]): ParsedSpec {
  return spec({
    id: "prd",
    type: "prd",
    content: `## Features\n\n${features.join("\n")}\n`,
  });
}

function story(id: string, title: string, references?: { id: string; relationship: string }[]) {
  const s = spec({ id, type: "user-story", content: `## Description\n\nSomething.\n` });
  s.frontmatter.title = title;
  if (references) s.frontmatter.references = references;
  return s;
}

function ctx(all: ParsedSpec[]): LintContext {
  return { spec: all[0]!, allSpecs: all };
}

describe("story-coverage — feature parsing", () => {
  it("reads bold-ID features", () => {
    expect(parseFeatures("## Features\n\n- **F1**: Create a user account.\n")).toEqual([
      "Create a user account.",
    ]);
  });

  it("also reads plain bullet features", () => {
    // The bold-ID form was the only one recognised, so any other PRD silently
    // parsed to zero features and the rule vacuously passed.
    expect(
      parseFeatures("## Features\n\n- Create a user account.\n- Delete an account.\n"),
    ).toEqual(["Create a user account.", "Delete an account."]);
  });

  it("reads F-prefixed bullets without bold", () => {
    expect(parseFeatures("## Features\n\n- F1: Create a user account.\n")).toEqual([
      "Create a user account.",
    ]);
  });

  it("returns nothing when there is no Features section", () => {
    expect(parseFeatures("## Goals\n\n- Something.\n")).toEqual([]);
  });
});

describe("story-coverage — matching", () => {
  it("counts a story that declares a reference to the PRD as coverage", () => {
    // A story pointing at the PRD is explicit evidence. Ignoring it was the
    // reason a suite with real stories warned on every feature.
    const all = [
      prd(["- **F1**: Create a user account with an email address and display name."]),
      story("story-create-user", "Create a user account", [
        { id: "prd", relationship: "depends-on" },
      ]),
    ];
    expect(storyCoverageRule.run(ctx(all))).toHaveLength(0);
  });

  it("counts a story whose title overlaps the feature wording", () => {
    const all = [
      prd(["- **F2**: Delete a user account and revoke its sessions."]),
      story("story-delete", "Delete a user account"),
    ];
    expect(storyCoverageRule.run(ctx(all))).toHaveLength(0);
  });

  it("still reports a feature nothing covers", () => {
    const all = [
      prd(["- **F3**: Export an audit log of every administrative action."]),
      story("story-unrelated", "Change the theme colour"),
    ];
    const diags = storyCoverageRule.run(ctx(all));
    expect(diags).toHaveLength(1);
    expect(diags[0]!.message).toContain("audit log");
  });

  it("does not treat one story as covering every feature", () => {
    const all = [
      prd([
        "- **F1**: Create a user account.",
        "- **F2**: Export an audit log of administrative actions.",
      ]),
      story("story-create", "Create a user account", [{ id: "prd", relationship: "depends-on" }]),
    ];
    // The reference proves *a* feature is covered, not all of them; the
    // uncovered one must still be reported.
    const diags = storyCoverageRule.run(ctx(all));
    expect(diags).toHaveLength(1);
    expect(diags[0]!.message).toContain("audit log");
  });
});

import { describe, it, expect } from "vitest";
import { storyCoverageRule, parseFeatures, parseFeatureEntries } from "./story-coverage.js";
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

describe("parseFeatureEntries — the one parser both commands use", () => {
  // `generate story` carried its own regex requiring `**F<N>**:`, so the same
  // PRD produced three features in lint and zero in the generator. Anything
  // that needs to know a PRD's features now calls this.
  it("reads bullets with no feature ID, and reports no number for them", () => {
    const content = `## Features

- **Invoice creation** — finance creates an invoice for a customer.
- **Invoice listing** — finance lists invoices and filters by customer.

## Success Criteria
`;
    const entries = parseFeatureEntries(content);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.num).toBeUndefined();
    expect(entries[0]!.text).toContain("Invoice creation");
  });

  it("keeps the number when the author gave one", () => {
    const content = `## Features

- **F1**: Invoice creation
- **F7**: Invoice reminders

## Success Criteria
`;
    const entries = parseFeatureEntries(content);
    expect(entries.map((f) => f.num)).toEqual(["1", "7"]);
    expect(entries.map((f) => f.text)).toEqual(["Invoice creation", "Invoice reminders"]);
  });

  it("agrees with parseFeatures on the text", () => {
    const content = "## Features\n\n- **F1**: Alpha\n- Beta\n\n## Next\n";
    expect(parseFeatureEntries(content).map((f) => f.text)).toEqual(parseFeatures(content));
  });
});

describe("story-coverage — sibling features are told apart", () => {
  // Two features sharing half their words. A story for the first used to satisfy
  // both, because 2 of 4 words cleared the 0.34 threshold a referencing story
  // gets. `lint` then said nothing, `ready` asserted "All PRD features have
  // corresponding stories", and `generate story` refused to stub the missing one.
  const features = [
    "- **F1**: Export the invoice report as CSV.",
    "- **F2**: Export the payroll report as PDF.",
  ];
  const refs = [{ id: "prd", relationship: "depends-on" }];

  it("flags the sibling that has no story", () => {
    const all = [prd(features), story("story-1", "Export the invoice report as CSV", refs)];
    const results = storyCoverageRule.run(ctx(all));
    expect(results).toHaveLength(1);
    expect(results[0]!.message).toContain("payroll");
  });

  it("stays quiet once both siblings have a story", () => {
    const all = [
      prd(features),
      story("story-1", "Export the invoice report as CSV", refs),
      story("story-2", "Export the payroll report as PDF", refs),
    ];
    expect(storyCoverageRule.run(ctx(all))).toHaveLength(0);
  });

  it("does not need a distinctive word when a PRD has one feature", () => {
    const all = [
      prd(["- **F1**: Export the invoice report as CSV."]),
      story("story-1", "Export the invoice report as CSV", refs),
    ];
    expect(storyCoverageRule.run(ctx(all))).toHaveLength(0);
  });
});

describe("story-coverage — one shared domain word is not coverage", () => {
  // "finance" is a word the whole suite uses. A story about amending invoices
  // that opens "as a member of finance" hit one of the two words that set the
  // finance-console feature apart, and that was enough to wave it through.
  it("does not accept a story that matches only half of what sets a feature apart", () => {
    const all = [
      prd([
        "- **F1**: Amend an open invoice before it is paid.",
        "- **F2**: List customers for the finance console.",
      ]),
      story("story-1", "Amend an open invoice before it is paid", [
        { id: "prd", relationship: "depends-on" },
      ]),
    ];
    all[1]!.content = "## Description\n\nAs a member of finance, I want to amend an invoice.\n";

    const results = storyCoverageRule.run(ctx(all));
    expect(results).toHaveLength(1);
    expect(results[0]!.message).toContain("finance console");
  });
});

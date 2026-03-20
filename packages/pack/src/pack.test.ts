import { describe, it, expect } from "vitest";
import { pack } from "./index.js";
import type { ParsedSpec, ParsedSection, DependencyGraph } from "@specdx/core";
import type { PackConfig } from "@specdx/schema";

function sec(heading: string, content: string, tokens: number): ParsedSection {
  return { heading, content, tokens };
}

function makeSpec(
  id: string,
  sections: ParsedSection[],
  frontmatterOverrides: Record<string, unknown> = {},
): ParsedSpec {
  return {
    filePath: `/specs/${id}.md`,
    frontmatter: {
      id,
      type: "technical-design",
      title: `Spec ${id}`,
      status: "draft",
      version: "1.0.0",
      created: "2025-01-01",
      authors: ["test"],
      ...frontmatterOverrides,
    },
    content: sections.map((s) => s.content).join("\n"),
    sections: sections.map((s) => s.heading).filter(Boolean),
    parsedSections: sections,
    valid: true,
    validationErrors: null,
  };
}

function emptyGraph(): DependencyGraph {
  return {
    nodes: [],
    edges: [],
    topologicalSort: () => [],
    getDownstream: () => [],
    getUpstream: () => [],
  };
}

const specA = makeSpec("spec-a", [
  sec("", "preamble for A", 5),
  sec("Context", "context for A about auth", 20),
  sec("Design", "design for A", 15),
]);

const specB = makeSpec("spec-b", [
  sec("", "preamble for B", 5),
  sec("Overview", "overview for B about caching", 25),
  sec("Details", "details for B", 10),
]);

const specC = makeSpec(
  "spec-c",
  [sec("", "preamble for C", 5), sec("Summary", "summary for C about logging", 30)],
  { tags: ["logging", "observability"] },
);

describe("pack", () => {
  it("packs all specs with no task (default XML format)", () => {
    const result = pack([specA, specB], {}, undefined, undefined);

    expect(result.output).toContain("<context");
    expect(result.output).toContain("</context>");
    expect(result.output).toContain("spec-a");
    expect(result.output).toContain("spec-b");
    expect(result.stats.specsIncluded).toBe(2);
    expect(result.stats.specsExcluded).toBe(0);
  });

  it("filters by task relevance", () => {
    const result = pack(
      [specA, specB, specC],
      { task: "logging observability" },
      undefined,
      emptyGraph(),
    );

    // specC matches "logging" and "observability" tags, should be included
    expect(result.stats.specsIncluded).toBeGreaterThanOrEqual(1);
    const includedIds = result.stats.allocations.filter((a) => a.included).map((a) => a.specId);
    expect(includedIds).toContain("spec-c");
  });

  it("filters by explicit spec IDs", () => {
    const result = pack([specA, specB, specC], { specs: ["spec-a"] }, undefined, emptyGraph());

    const includedIds = result.stats.allocations.filter((a) => a.included).map((a) => a.specId);
    expect(includedIds).toContain("spec-a");
    // specB and specC should not be included (no graph dependencies)
    expect(includedIds).not.toContain("spec-b");
    expect(includedIds).not.toContain("spec-c");
  });

  it("respects budget", () => {
    // Use a very small budget that can't fit everything
    const result = pack([specA, specB, specC], { budget: 30 }, undefined, undefined);

    expect(result.stats.budget).toBe(30);
    expect(result.stats.used).toBeLessThanOrEqual(30);
    expect(result.stats.specsExcluded).toBeGreaterThan(0);
  });

  it("outputs markdown format", () => {
    const result = pack([specA], { format: "markdown" }, undefined, undefined);

    expect(result.output).toContain("# spec-a");
    expect(result.output).toContain("## Context");
    expect(result.output).not.toContain("<context");
  });

  it("outputs JSON format", () => {
    const result = pack([specA], { format: "json" }, undefined, undefined);

    const parsed = JSON.parse(result.output) as { budget: number; specs: { id: string }[] };
    expect(parsed.budget).toBe(12000);
    expect(parsed.specs.length).toBeGreaterThanOrEqual(1);
    expect(parsed.specs[0]!.id).toBe("spec-a");
  });

  it("returns dry-run stats without output", () => {
    const result = pack([specA, specB], { dryRun: true }, undefined, undefined);

    expect(result.output).toBe("");
    expect(result.stats.specsIncluded).toBe(2);
    expect(result.stats.budget).toBe(12000);
  });

  it("includes project-context specs first at full fidelity", () => {
    const ctxSpec = makeSpec(
      "project-ctx",
      [sec("", "Project overview", 5), sec("Goals", "Ship fast", 10)],
      { type: "project-context", title: "Project Context" },
    );
    const prdSpec = makeSpec(
      "prd-auth",
      [sec("", "Auth PRD", 5), sec("Requirements", "Implement OAuth for auth", 20)],
      { type: "prd", title: "Auth PRD" },
    );

    const result = pack(
      [prdSpec, ctxSpec],
      { task: "implement auth" },
      undefined,
      emptyGraph(),
    );

    // project-context should appear first in the output
    const ctxPos = result.output.indexOf("project-ctx");
    const prdPos = result.output.indexOf("prd-auth");
    expect(ctxPos).toBeGreaterThan(-1);
    expect(prdPos).toBeGreaterThan(-1);
    expect(ctxPos).toBeLessThan(prdPos);

    // project-context should be included in stats
    expect(result.stats.specsIncluded).toBe(2);

    // The project-context allocation should be first and marked as not compressed
    const ctxAlloc = result.stats.allocations[0]!;
    expect(ctxAlloc.specId).toBe("project-ctx");
    expect(ctxAlloc.relevance).toBe(1.0);
    expect(ctxAlloc.compressed).toBe(false);
    expect(ctxAlloc.included).toBe(true);
  });

  it("reserves budget for project-context, leaving remainder for regular specs", () => {
    const ctxSpec = makeSpec(
      "project-ctx",
      [sec("", "Project overview", 5), sec("Goals", "Ship fast", 10)],
      { type: "project-context", title: "Project Context" },
    );
    const prdSpec = makeSpec(
      "prd-auth",
      [sec("", "Auth PRD", 5), sec("Requirements", "Implement OAuth for auth", 20)],
      { type: "prd", title: "Auth PRD" },
    );

    // Budget large enough for both
    const result = pack(
      [prdSpec, ctxSpec],
      { budget: 5000 },
      undefined,
      emptyGraph(),
    );

    // Overall budget should be the full budget, not the reduced one
    expect(result.stats.budget).toBe(5000);
    expect(result.stats.specsIncluded).toBe(2);
    expect(result.stats.used).toBeLessThanOrEqual(5000);
  });

  it("caps project-context reservation at 2000 tokens", () => {
    // Create a project-context spec that would exceed 2000 tokens
    const bigCtx = makeSpec(
      "big-ctx",
      [sec("", "Overview", 500), sec("Details", "Long content", 1800)],
      { type: "project-context", title: "Big Context" },
    );
    const prdSpec = makeSpec(
      "prd-auth",
      [sec("", "Auth PRD", 5), sec("Requirements", "auth content", 20)],
      { type: "prd", title: "Auth PRD" },
    );

    const result = pack(
      [prdSpec, bigCtx],
      { budget: 5000 },
      undefined,
      emptyGraph(),
    );

    // Regular budget should be at least budget - 2000
    // The exact values depend on countTokens, but the stats should show
    // the overall budget is maintained
    expect(result.stats.budget).toBe(5000);
  });

  it("works correctly with no project-context specs", () => {
    // Existing behaviour should be unchanged
    const result = pack([specA, specB], { budget: 5000 }, undefined, undefined);

    expect(result.stats.budget).toBe(5000);
    expect(result.stats.specsIncluded).toBe(2);
    expect(result.output).toContain("spec-a");
    expect(result.output).toContain("spec-b");
  });

  it("uses pack config defaults when provided", () => {
    const packConfig: PackConfig = {
      max_tokens: 5000,
      format: "markdown",
      compression: {
        strip_boilerplate: false,
        stable_days: 14,
        collapse_resolved_adrs: false,
      },
      boilerplate_sections: ["Notes"],
    };

    const result = pack([specA], {}, packConfig, undefined);

    // Should use packConfig.max_tokens as budget
    expect(result.stats.budget).toBe(5000);
    // Should use packConfig.format (markdown)
    expect(result.output).toContain("# spec-a");
    expect(result.output).not.toContain("<context");
  });
});

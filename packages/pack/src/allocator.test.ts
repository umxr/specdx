import { describe, it, expect } from "vitest";
import { allocate } from "./allocator.js";
import type { ParsedSpec, ParsedSection } from "@sdx/core";
import type { RelevanceScore, CompressionOptions } from "./types.js";

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

function makeScore(specId: string, score: number): RelevanceScore {
  return {
    specId,
    score,
    rawScore: score,
    matchedKeywords: [],
    graphBoosted: false,
  };
}

const defaultCompression: CompressionOptions = {
  stripBoilerplate: true,
  stableDays: 0,
  collapseResolvedAdrs: true,
  boilerplateSections: ["Changelog"],
};

describe("allocate", () => {
  it("includes all specs when within budget", () => {
    const specs = [
      makeSpec("s1", [sec("", "preamble", 10), sec("Context", "ctx", 20)]),
      makeSpec("s2", [sec("", "preamble", 15), sec("Design", "design", 25)]),
    ];
    const scores = [makeScore("s1", 0.8), makeScore("s2", 0.6)];
    const result = allocate(specs, scores, {
      budget: 1000,
      full: false,
      compression: defaultCompression,
    });

    expect(result.specs).toHaveLength(2);
    expect(result.stats.specsIncluded).toBe(2);
    expect(result.stats.specsExcluded).toBe(0);
    expect(result.stats.used).toBeLessThanOrEqual(result.stats.budget);
  });

  it("drops lowest-relevance specs when over budget", () => {
    const specs = [
      makeSpec("s1", [sec("Context", "important context here", 50)]),
      makeSpec("s2", [sec("Design", "design details here", 50)]),
      makeSpec("s3", [sec("Notes", "extra notes content", 50)]),
    ];
    const scores = [
      makeScore("s1", 0.9),
      makeScore("s2", 0.5),
      makeScore("s3", 0.2),
    ];
    // Budget only enough for ~2 specs
    const result = allocate(specs, scores, {
      budget: 100,
      full: false,
      compression: defaultCompression,
    });

    expect(result.stats.specsIncluded).toBe(2);
    expect(result.stats.specsExcluded).toBe(1);
    // The excluded spec should be the lowest relevance (s3)
    const includedIds = result.specs.map((s) => s.specId);
    expect(includedIds).toContain("s1");
    expect(includedIds).toContain("s2");
    expect(includedIds).not.toContain("s3");
    expect(result.stats.used).toBeLessThanOrEqual(result.stats.budget);
  });

  it("applies compression when not in full mode (strips boilerplate Changelog)", () => {
    const specs = [
      makeSpec("s1", [
        sec("Context", "context content", 20),
        sec("Changelog", "v1 changes", 30),
        sec("Decision", "we decided", 15),
      ]),
    ];
    const scores = [makeScore("s1", 1.0)];
    const result = allocate(specs, scores, {
      budget: 1000,
      full: false,
      compression: defaultCompression,
    });

    expect(result.specs).toHaveLength(1);
    const spec = result.specs[0]!;
    const headings = spec.sections.map((s) => s.heading);
    // Changelog should be stripped as boilerplate
    expect(headings).not.toContain("Changelog");
    expect(headings).toContain("Context");
    expect(headings).toContain("Decision");
  });

  it("skips compression in full mode (Changelog preserved)", () => {
    const specs = [
      makeSpec("s1", [
        sec("Context", "context content", 20),
        sec("Changelog", "v1 changes", 30),
        sec("Decision", "we decided", 15),
      ]),
    ];
    const scores = [makeScore("s1", 1.0)];
    const result = allocate(specs, scores, {
      budget: 1000,
      full: true,
      compression: defaultCompression,
    });

    expect(result.specs).toHaveLength(1);
    const spec = result.specs[0]!;
    const headings = spec.sections.map((s) => s.heading);
    // In full mode, Changelog should be preserved
    expect(headings).toContain("Changelog");
    expect(headings).toContain("Context");
    expect(headings).toContain("Decision");
    // All sections should be uncompressed
    expect(spec.sections.every((s) => !s.compressed)).toBe(true);
  });

  it("reports correct stats (budget, used, allocations)", () => {
    const specs = [
      makeSpec("s1", [sec("Context", "context", 20)]),
      makeSpec("s2", [sec("Design", "design", 30)]),
    ];
    const scores = [makeScore("s1", 0.9), makeScore("s2", 0.7)];
    const result = allocate(specs, scores, {
      budget: 500,
      full: false,
      compression: defaultCompression,
    });

    expect(result.stats.budget).toBe(500);
    expect(result.stats.used).toBeGreaterThan(0);
    expect(result.stats.allocations).toHaveLength(2);

    const alloc1 = result.stats.allocations.find((a) => a.specId === "s1");
    const alloc2 = result.stats.allocations.find((a) => a.specId === "s2");
    expect(alloc1).toBeDefined();
    expect(alloc1!.relevance).toBe(0.9);
    expect(alloc1!.included).toBe(true);
    expect(alloc1!.tokens).toBeGreaterThan(0);
    expect(alloc2).toBeDefined();
    expect(alloc2!.relevance).toBe(0.7);
    expect(alloc2!.included).toBe(true);
  });

  it("collapses resolved ADRs", () => {
    const specs = [
      makeSpec(
        "adr-001",
        [sec("", "preamble", 10), sec("Context", "context", 20), sec("Decision", "decision", 25)],
        { type: "adr", title: "Use React", status: "superseded" },
      ),
    ];
    const scores = [makeScore("adr-001", 1.0)];
    const result = allocate(specs, scores, {
      budget: 1000,
      full: false,
      compression: defaultCompression,
    });

    expect(result.specs).toHaveLength(1);
    const spec = result.specs[0]!;
    expect(spec.collapsed).toBe(true);
    expect(spec.collapsedSummary).toBe("[ADR] Use React — superseded");
    expect(spec.sections).toHaveLength(0);
  });

  it("empty specs list produces valid result", () => {
    const result = allocate([], [], {
      budget: 1000,
      full: false,
      compression: defaultCompression,
    });

    expect(result.specs).toHaveLength(0);
    expect(result.stats.budget).toBe(1000);
    expect(result.stats.used).toBe(0);
    expect(result.stats.specsIncluded).toBe(0);
    expect(result.stats.specsExcluded).toBe(0);
    expect(result.stats.sectionsCompressed).toBe(0);
    expect(result.stats.allocations).toHaveLength(0);
  });
});

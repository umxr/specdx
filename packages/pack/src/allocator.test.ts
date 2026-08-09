import { describe, it, expect } from "vitest";
import { allocate } from "./allocator.js";
import type { ParsedSpec, ParsedSection } from "@specdx/core";
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
    const scores = [makeScore("s1", 0.9), makeScore("s2", 0.5), makeScore("s3", 0.2)];
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

describe("trim before exclusion (issue #9)", () => {
  it("trims a high-relevance spec into the remaining budget instead of excluding it", () => {
    const small = makeSpec("small", [sec("Intro", "short", 100)]);
    const big = makeSpec("big", [
      sec("Overview", "first section", 120),
      sec("Details", "second section", 400),
      sec("Appendix", "third section", 400),
    ]);
    const scores = [makeScore("small", 1.0), { ...makeScore("big", 1.0), idMatched: true }];

    const result = allocate([small, big], scores, {
      budget: 300,
      full: true,
      compression: defaultCompression,
    });

    const bigAlloc = result.stats.allocations.find((a) => a.specId === "big")!;
    expect(bigAlloc.included).toBe(true);
    expect(bigAlloc.compressed).toBe(true);
    expect(result.stats.used).toBeLessThanOrEqual(300);

    const bigSpec = result.specs.find((s) => s.specId === "big")!;
    expect(bigSpec.sections[0]!.content).toBe("first section");
    expect(bigSpec.sections.some((s) => s.content.includes("omitted"))).toBe(true);
  });

  it("still excludes low-relevance specs that do not fit", () => {
    const small = makeSpec("small", [sec("Intro", "short", 100)]);
    const big = makeSpec("big", [sec("Overview", "first", 120), sec("Details", "second", 400)]);
    const scores = [makeScore("small", 1.0), makeScore("big", 0.3)];

    const result = allocate([small, big], scores, {
      budget: 300,
      full: true,
      compression: defaultCompression,
    });

    const bigAlloc = result.stats.allocations.find((a) => a.specId === "big")!;
    expect(bigAlloc.included).toBe(false);
  });

  it("emits omission markers even when kept sections nearly exhaust the budget (issue #12)", () => {
    // Remaining budget for "big" is 200: greedy keeps 95 + 100 = 195 tokens,
    // leaving less than one marker's cost. The marker must still be emitted.
    const small = makeSpec("small", [sec("Intro", "short", 100)]);
    const big = makeSpec("big", [
      sec("Overview", "first section", 95),
      sec("Architecture", "second section", 100),
      sec("Data Model", "third section", 100),
      sec("Risks", "fourth section", 100),
    ]);
    const scores = [makeScore("small", 1.0), { ...makeScore("big", 1.0), idMatched: true }];

    const result = allocate([small, big], scores, {
      budget: 300,
      full: true,
      compression: defaultCompression,
    });

    const bigSpec = result.specs.find((s) => s.specId === "big")!;
    expect(bigSpec.sections.some((s) => s.content.includes("omitted"))).toBe(true);
    expect(result.stats.used).toBeLessThanOrEqual(300);
  });

  it("marker names the omitted sections and stats count them (issue #12)", () => {
    const small = makeSpec("small", [sec("Intro", "short", 100)]);
    const big = makeSpec("big", [
      sec("Overview", "first section", 120),
      sec("Data Model", "second section", 400),
      sec("Risks", "third section", 400),
    ]);
    const scores = [makeScore("small", 1.0), { ...makeScore("big", 1.0), idMatched: true }];

    const result = allocate([small, big], scores, {
      budget: 300,
      full: true,
      compression: defaultCompression,
    });

    const bigSpec = result.specs.find((s) => s.specId === "big")!;
    const marker = bigSpec.sections.find((s) => s.content.includes("omitted"))!;
    expect(marker).toBeDefined();
    expect(marker.content).toContain("Data Model");
    expect(marker.content).toContain("Risks");
    expect(result.stats.sectionsOmitted).toBe(2);

    const bigAlloc = result.stats.allocations.find((a) => a.specId === "big")!;
    expect(bigAlloc.compressed).toBe(true);
  });

  it("reports zero omitted sections when nothing is trimmed", () => {
    const specs = [makeSpec("s1", [sec("Context", "ctx", 20)])];
    const result = allocate(specs, [makeScore("s1", 1.0)], {
      budget: 1000,
      full: false,
      compression: defaultCompression,
    });
    expect(result.stats.sectionsOmitted).toBe(0);
  });

  it("prefers the id-matched spec on relevance ties", () => {
    const a = makeSpec("aaa", [sec("A", "content a", 200)]);
    const b = makeSpec("bbb", [sec("B", "content b", 200)]);
    const scores = [makeScore("aaa", 1.0), { ...makeScore("bbb", 1.0), idMatched: true }];

    const result = allocate([a, b], scores, {
      budget: 200,
      full: true,
      compression: defaultCompression,
    });

    const included = result.stats.allocations.filter((x) => x.included).map((x) => x.specId);
    expect(included).toContain("bbb");
  });
});

/**
 * Compression exists to fit content into a budget. Applied when the budget is
 * not under pressure it is pure loss: the caller asked for context and got
 * stubs instead, while the stats reported a barely-touched budget (issue #33).
 */
describe("allocate — staleness collapse is budget-driven", () => {
  const stale: CompressionOptions = { ...defaultCompression, stableDays: 7 };
  const oldSpec = { updated: "2020-01-01" };

  it("keeps stale content when it fits the budget", () => {
    const specs = [
      makeSpec("s1", [sec("Context", "real context content", 100)], oldSpec),
      makeSpec("s2", [sec("Design", "real design content", 100)], oldSpec),
    ];
    const scores = [makeScore("s1", 0.9), makeScore("s2", 0.8)];

    const result = allocate(specs, scores, { budget: 1000, full: false, compression: stale });

    expect(result.stats.sectionsCompressed).toBe(0);
    expect(result.specs.flatMap((s) => s.sections).map((s) => s.content)).toEqual([
      "real context content",
      "real design content",
    ]);
  });

  it("collapses stale content when the budget cannot hold it", () => {
    const specs = [
      makeSpec("s1", [sec("Context", "real context content", 100)], oldSpec),
      makeSpec("s2", [sec("Design", "real design content", 100)], oldSpec),
    ];
    const scores = [makeScore("s1", 0.9), makeScore("s2", 0.8)];

    const result = allocate(specs, scores, { budget: 120, full: false, compression: stale });

    expect(result.stats.sectionsCompressed).toBeGreaterThan(0);
    expect(result.stats.used).toBeLessThanOrEqual(120);
  });

  it("collapses the least relevant spec first", () => {
    // Under pressure, pay for the collapse where it costs the reader least.
    const specs = [
      makeSpec("high", [sec("Context", "high relevance content", 100)], oldSpec),
      makeSpec("low", [sec("Design", "low relevance content", 100)], oldSpec),
    ];
    const scores = [makeScore("high", 0.9), makeScore("low", 0.2)];

    const result = allocate(specs, scores, { budget: 130, full: false, compression: stale });

    const byId = new Map(result.specs.map((s) => [s.specId, s]));
    expect(byId.get("high")?.sections.some((s) => s.compressed)).toBe(false);
    expect(byId.get("low")?.sections.every((s) => s.compressed)).toBe(true);
  });

  it("still strips boilerplate when the budget is roomy", () => {
    // Boilerplate stripping and superseded-ADR collapse are hygiene, not
    // budget management -- a Changelog section is noise at any budget.
    const specs = [
      makeSpec("s1", [sec("Changelog", "v1 v2 v3", 50), sec("Context", "real content", 50)], {
        updated: "2020-01-01",
      }),
    ];

    const result = allocate(specs, [makeScore("s1", 0.9)], {
      budget: 1000,
      full: false,
      compression: stale,
    });

    expect(result.specs[0]?.sections.map((s) => s.heading)).toEqual(["Context"]);
  });
});

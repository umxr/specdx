import { describe, it, expect } from "vitest";
import { compressSpec } from "./compressor.js";
import type { CompressionOptions } from "./types.js";
import type { ParsedSection } from "@sdx/core";

const defaultOptions: CompressionOptions = {
  stripBoilerplate: false,
  stableDays: 0,
  collapseResolvedAdrs: false,
  boilerplateSections: [],
};

function makeSections(headings: string[]): ParsedSection[] {
  return headings.map((h) => ({
    heading: h,
    content: `Content for ${h || "preamble"}`,
    tokens: 10,
  }));
}

describe("compressSpec", () => {
  it("collapses superseded ADRs to one-liner", () => {
    const sections = makeSections(["", "Context", "Decision"]);
    const result = compressSpec(
      "adr-001",
      "adr",
      "Use React",
      "superseded",
      "2025-01-01",
      sections,
      { ...defaultOptions, collapseResolvedAdrs: true },
    );

    expect(result.collapsed).toBe(true);
    expect(result.collapsedSummary).toBe("[ADR] Use React — superseded");
    expect(result.sections).toHaveLength(0);
  });

  it("does not collapse non-superseded ADRs", () => {
    const sections = makeSections(["Context", "Decision"]);
    const result = compressSpec(
      "adr-002",
      "adr",
      "Use React",
      "accepted",
      "2025-01-01",
      sections,
      { ...defaultOptions, collapseResolvedAdrs: true },
    );

    expect(result.collapsed).toBe(false);
    expect(result.collapsedSummary).toBeUndefined();
    expect(result.sections).toHaveLength(2);
  });

  it("strips boilerplate sections", () => {
    const sections = makeSections(["Context", "Changelog", "Decision"]);
    const result = compressSpec(
      "adr-003",
      "adr",
      "Use React",
      "accepted",
      undefined,
      sections,
      {
        ...defaultOptions,
        stripBoilerplate: true,
        boilerplateSections: ["Changelog"],
      },
    );

    expect(result.sections).toHaveLength(2);
    expect(result.sections.map((s) => s.heading)).toEqual([
      "Context",
      "Decision",
    ]);
  });

  it("boilerplate matching is case-insensitive", () => {
    const sections = makeSections(["Context", "CHANGELOG", "Decision"]);
    const result = compressSpec(
      "adr-004",
      "adr",
      "Use React",
      "accepted",
      undefined,
      sections,
      {
        ...defaultOptions,
        stripBoilerplate: true,
        boilerplateSections: ["changelog"],
      },
    );

    expect(result.sections).toHaveLength(2);
    expect(result.sections.map((s) => s.heading)).toEqual([
      "Context",
      "Decision",
    ]);
  });

  it("collapses sections when spec is stale", () => {
    const sections = makeSections(["", "Context", "Decision"]);
    const result = compressSpec(
      "rfc-001",
      "rfc",
      "Old RFC",
      "accepted",
      "2025-01-01",
      sections,
      { ...defaultOptions, stableDays: 30 },
    );

    expect(result.collapsed).toBe(false);
    // Preamble should pass through
    expect(result.sections[0]!.compressed).toBe(false);
    expect(result.sections[0]!.heading).toBe("");
    // Headed sections should be compressed
    expect(result.sections[1]!.compressed).toBe(true);
    expect(result.sections[1]!.content).toMatch(
      /\[Unchanged since 2025-01-01 — \d+ tokens omitted\]/,
    );
    expect(result.sections[2]!.compressed).toBe(true);
  });

  it("does not collapse when spec is fresh", () => {
    const sections = makeSections(["Context", "Decision"]);
    const today = new Date().toISOString().slice(0, 10);
    const result = compressSpec(
      "rfc-002",
      "rfc",
      "Fresh RFC",
      "draft",
      today,
      sections,
      { ...defaultOptions, stableDays: 30 },
    );

    expect(result.sections.every((s) => !s.compressed)).toBe(true);
  });

  it("does not collapse when updatedDate is undefined (treat as fresh)", () => {
    const sections = makeSections(["Context", "Decision"]);
    const result = compressSpec(
      "rfc-003",
      "rfc",
      "No Date RFC",
      "draft",
      undefined,
      sections,
      { ...defaultOptions, stableDays: 30 },
    );

    expect(result.sections.every((s) => !s.compressed)).toBe(true);
  });

  it("passes through with no compression when all options disabled", () => {
    const sections = makeSections(["", "Context", "Decision"]);
    const result = compressSpec(
      "rfc-004",
      "rfc",
      "Normal RFC",
      "draft",
      "2025-01-01",
      sections,
      defaultOptions,
    );

    expect(result.collapsed).toBe(false);
    expect(result.sections).toHaveLength(3);
    expect(result.sections.every((s) => !s.compressed)).toBe(true);
    expect(result.sections[0]!.content).toBe("Content for preamble");
  });

  it("preserves preamble sections (empty heading) even when stale", () => {
    const sections = makeSections(["", "Context"]);
    const result = compressSpec(
      "rfc-005",
      "rfc",
      "Stale RFC",
      "accepted",
      "2025-01-01",
      sections,
      { ...defaultOptions, stableDays: 30 },
    );

    // Preamble preserved
    expect(result.sections[0]!.heading).toBe("");
    expect(result.sections[0]!.compressed).toBe(false);
    expect(result.sections[0]!.content).toBe("Content for preamble");
    // Headed section compressed
    expect(result.sections[1]!.compressed).toBe(true);
  });
});

import { describe, it, expect } from "vitest";
import { getPreset } from "./presets.js";
import { createLintEngine } from "./engine.js";
import type { ParsedSpec } from "@specdx/core";

/**
 * A complete, valid PRD whose Non-Goals section is a placeholder. Every
 * required section is present, so the only finding is a warning — which is
 * exactly what a preset is supposed to be able to escalate.
 */
const REQUIRED = ["Problem Statement", "Goals", "Non-Goals", "Features", "Success Criteria"];

const specWithWarning: ParsedSpec = {
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
  content: REQUIRED.map((h) => `## ${h}\n\nReal content for ${h}.\n`).join("\n"),
  sections: REQUIRED,
  parsedSections: REQUIRED.map((heading) => ({
    heading,
    content: heading === "Non-Goals" ? "<!-- placeholder -->" : `Real content for ${heading}.`,
    tokens: 6,
  })),
  valid: true,
  validationErrors: null,
} as unknown as ParsedSpec;

function severitiesFor(preset: string): string[] {
  const engine = createLintEngine({ rules: getPreset(preset) });
  return engine.lint([specWithWarning]).diagnostics.map((d) => d.severity);
}

describe("presets", () => {
  it("minimal preset includes only structure rules", () => {
    const rules = getPreset("minimal");
    expect(rules.every((r) => r.id.startsWith("structure/"))).toBe(true);
  });

  it("recommended preset includes structure + content rules", () => {
    const rules = getPreset("recommended");
    expect(rules.some((r) => r.id.startsWith("structure/"))).toBe(true);
    expect(rules.some((r) => r.id.startsWith("completeness/"))).toBe(true);
    expect(rules.some((r) => r.id.startsWith("clarity/"))).toBe(true);
  });

  it("strict preset includes all rules with error severity", () => {
    const rules = getPreset("strict");
    expect(rules.length).toBeGreaterThanOrEqual(7);
    expect(rules.every((r) => r.severity === "error")).toBe(true);
  });

  // Asserting that `getPreset("strict")` marks its rules `error` proved nothing:
  // the engine never read that field, so `strict` and `recommended` produced
  // identical output on every surface for as long as the preset existed. What a
  // preset is *for* is the diagnostics a user sees, so that is what is asserted.
  it("strict escalates the diagnostics a recommended run reports as warnings", () => {
    const recommended = severitiesFor("recommended");
    const strict = severitiesFor("strict");

    expect(recommended.length).toBeGreaterThan(0);
    expect(recommended).toContain("warn");

    expect(strict).toHaveLength(recommended.length);
    expect(strict.every((s) => s === "error")).toBe(true);
  });

  it("strict makes a warning-only suite fail", () => {
    const warnRun = createLintEngine({ rules: getPreset("recommended") }).lint([specWithWarning]);
    const strictRun = createLintEngine({ rules: getPreset("strict") }).lint([specWithWarning]);

    expect(warnRun.hasErrors).toBe(false);
    expect(strictRun.hasErrors).toBe(true);
  });
});

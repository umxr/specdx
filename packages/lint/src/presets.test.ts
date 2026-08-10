import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
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
  // Pin the environment: ambiguity-score-ai keys its behaviour off
  // ANTHROPIC_API_KEY, so a developer's real key must not change what these
  // tests observe. Individual tests opt back in with their own stub.
  beforeEach(() => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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

  it("strict preset promotes warn rules and leaves info rules alone", () => {
    const rules = getPreset("strict");
    expect(rules.length).toBeGreaterThanOrEqual(7);
    // No rule stays at warn — that is the preset's whole job.
    expect(rules.some((r) => r.severity === "warn")).toBe(false);
    // Info-class advisories survive as info: promoting them would make an
    // unfixable diagnostic fail the build (see the regression test below).
    expect(rules.some((r) => r.severity === "info")).toBe(true);
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

  // Audit run 4, N1: `ambiguity-score-ai` emits an advisory whenever
  // ANTHROPIC_API_KEY is set. Promoting it to error made `strict` fail every
  // suite — including a perfect one — in any environment carrying the key,
  // with a diagnostic no spec edit can satisfy. Strict promotes warnings;
  // advisories stay advisories.
  describe("with ANTHROPIC_API_KEY in the environment", () => {
    const cleanSpec: ParsedSpec = {
      ...specWithWarning,
      parsedSections: REQUIRED.map((heading) => ({
        heading,
        content: `Real content for ${heading}.`,
        tokens: 6,
      })),
    } as unknown as ParsedSpec;

    it("a clean suite still passes strict", () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "test-key");

      const strictRun = createLintEngine({ rules: getPreset("strict") }).lint([cleanSpec]);

      const advisory = strictRun.diagnostics.find((d) => d.ruleId === "clarity/ambiguity-score-ai");
      expect(advisory?.severity).toBe("info");
      expect(strictRun.hasErrors).toBe(false);
    });

    it("strict still fails on real warnings, advisory unchanged", () => {
      vi.stubEnv("ANTHROPIC_API_KEY", "test-key");

      const strictRun = createLintEngine({ rules: getPreset("strict") }).lint([specWithWarning]);

      expect(strictRun.hasErrors).toBe(true);
      const severities = new Map(strictRun.diagnostics.map((d) => [d.ruleId, d.severity]));
      expect(severities.get("clarity/ambiguity-score-ai")).toBe("info");
      expect(severities.get("completeness/no-placeholder-sections")).toBe("error");
    });
  });
});

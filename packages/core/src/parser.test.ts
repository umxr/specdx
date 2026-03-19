import { describe, it, expect } from "vitest";
import { parseSpec, ParseError } from "./parser.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../test/fixtures/specs");

describe("parseSpec", () => {
  it("parses a markdown spec with frontmatter", async () => {
    const spec = await parseSpec(join(fixturesDir, "prd.md"));
    expect(spec.frontmatter.id).toBe("prd-001");
    expect(spec.frontmatter.type).toBe("prd");
    expect(spec.frontmatter.title).toBe("User Authentication System");
    expect(spec.content).toContain("## Problem Statement");
    expect(spec.sections).toContain("Problem Statement");
    expect(spec.sections).toContain("Goals");
    expect(spec.sections).toContain("Features");
    expect(spec.filePath).toContain("prd.md");
  });

  it("parses a pure YAML spec", async () => {
    const spec = await parseSpec(join(fixturesDir, "story.yaml"));
    expect(spec.frontmatter.id).toBe("story-001");
    expect(spec.frontmatter.type).toBe("user-story");
    expect(spec.frontmatter["story_id"]).toBe("US-001");
    expect(spec.sections).toEqual([]);
    expect(spec.content).toBe("");
  });

  it("validates frontmatter against schema", async () => {
    const spec = await parseSpec(join(fixturesDir, "prd.md"));
    expect(spec.valid).toBe(true);
    expect(spec.validationErrors).toBeNull();
  });

  it("throws ParseError for nonexistent file", async () => {
    await expect(parseSpec("/nonexistent.md")).rejects.toThrow(ParseError);
  });

  describe("parsedSections", () => {
    it("extracts section content from fixture prd.md", async () => {
      const spec = await parseSpec(join(fixturesDir, "prd.md"));
      expect(spec.parsedSections.length).toBeGreaterThan(0);

      const problemSection = spec.parsedSections.find((s) => s.heading === "Problem Statement");
      expect(problemSection).toBeDefined();
      expect(problemSection!.content).toContain("Users need a secure way to authenticate.");
      expect(problemSection!.tokens).toBeGreaterThan(0);

      const goalsSection = spec.parsedSections.find((s) => s.heading === "Goals");
      expect(goalsSection).toBeDefined();
      expect(goalsSection!.content).toContain("Secure login flow");
      expect(goalsSection!.tokens).toBeGreaterThan(0);

      // sections derived from parsedSections should match
      const derivedSections = spec.parsedSections.map((s) => s.heading).filter(Boolean);
      expect(derivedSections).toEqual(spec.sections);
    });

    it("returns empty heading for preamble content", async () => {
      const spec = await parseSpec(join(fixturesDir, "prd.md"));
      const preamble = spec.parsedSections.find((s) => s.heading === "");
      expect(preamble).toBeDefined();
      expect(preamble!.content).toContain("# User Authentication System");
      expect(preamble!.tokens).toBeGreaterThan(0);
    });

    it("returns empty parsedSections for YAML specs", async () => {
      const spec = await parseSpec(join(fixturesDir, "story.yaml"));
      expect(spec.parsedSections).toEqual([]);
    });
  });
});

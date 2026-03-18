import { describe, it, expect } from "vitest";
import { storyCoverageRule } from "./story-coverage.js";
import { noVagueLanguageRule } from "./no-vague-language.js";
import { stalenessCheckRule } from "./staleness-check.js";
import type { LintContext } from "../types.js";
import type { ParsedSpec } from "@sdx/core";

function makeSpec(overrides: Partial<ParsedSpec> = {}): ParsedSpec {
  return {
    filePath: "specs/prd.md",
    frontmatter: {
      id: "prd-001",
      type: "prd",
      title: "Test PRD",
      status: "draft",
      version: "1.0",
      created: "2026-01-01",
      authors: ["dev"],
    },
    content: "",
    sections: [],
    valid: true,
    validationErrors: null,
    ...overrides,
  };
}

function makeContext(spec: ParsedSpec, allSpecs?: ParsedSpec[]): LintContext {
  return { spec, allSpecs: allSpecs ?? [spec] };
}

describe("story-coverage", () => {
  it("warns when PRD features lack corresponding user stories", () => {
    const prd = makeSpec({
      content: "## Features\n\n**F1**: Authentication\n\n**F2**: Dashboard",
    });
    const diags = storyCoverageRule.run(makeContext(prd, [prd]));
    expect(diags.length).toBe(2);
    expect(diags[0]!.ruleId).toBe("completeness/story-coverage");
    expect(diags[0]!.severity).toBe("warn");
    expect(diags[0]!.message).toContain("Authentication");
    expect(diags[1]!.message).toContain("Dashboard");
  });

  it("passes when features have corresponding user stories", () => {
    const prd = makeSpec({
      content: "## Features\n\n**F1**: Authentication",
    });
    const story = makeSpec({
      filePath: "specs/story-001.md",
      frontmatter: {
        id: "story-001",
        type: "user-story",
        title: "Authentication story",
        status: "draft",
        version: "1.0",
        created: "2026-01-01",
        authors: ["dev"],
      },
      content: "As a user I want to log in using Authentication",
    });
    const diags = storyCoverageRule.run(makeContext(prd, [prd, story]));
    expect(diags).toHaveLength(0);
  });

  it("passes when feature name matches story title", () => {
    const prd = makeSpec({
      content: "## Features\n\n**F1**: Dashboard",
    });
    const story = makeSpec({
      filePath: "specs/story-002.md",
      frontmatter: {
        id: "story-002",
        type: "user-story",
        title: "Dashboard",
        status: "draft",
        version: "1.0",
        created: "2026-01-01",
        authors: ["dev"],
      },
      content: "As a user I want a main screen",
    });
    const diags = storyCoverageRule.run(makeContext(prd, [prd, story]));
    expect(diags).toHaveLength(0);
  });

  it("skips non-PRD specs", () => {
    const story = makeSpec({
      frontmatter: {
        id: "story-001",
        type: "user-story",
        title: "Some story",
        status: "draft",
        version: "1.0",
        created: "2026-01-01",
        authors: ["dev"],
      },
      content: "**F1**: Feature without story",
    });
    const diags = storyCoverageRule.run(makeContext(story, [story]));
    expect(diags).toHaveLength(0);
  });

  it("passes when PRD has no feature patterns", () => {
    const prd = makeSpec({ content: "## Overview\n\nThis is a PRD with no features listed." });
    const diags = storyCoverageRule.run(makeContext(prd, [prd]));
    expect(diags).toHaveLength(0);
  });
});

describe("no-vague-language", () => {
  it("flags 'as appropriate' in spec content", () => {
    const spec = makeSpec({ content: "Handle the error as appropriate." });
    const diags = noVagueLanguageRule.run(makeContext(spec));
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.ruleId).toBe("clarity/no-vague-language");
    expect(diags[0]!.severity).toBe("warn");
    expect(diags[0]!.message).toContain("as appropriate");
  });

  it("flags 'TBD' in spec content", () => {
    const spec = makeSpec({ content: "The implementation is TBD." });
    const diags = noVagueLanguageRule.run(makeContext(spec));
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.message).toContain("TBD");
  });

  it("flags 'TODO' in spec content", () => {
    const spec = makeSpec({ content: "TODO: figure out the data model." });
    const diags = noVagueLanguageRule.run(makeContext(spec));
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.message).toContain("TODO");
  });

  it("flags 'etc.' in spec content", () => {
    const spec = makeSpec({ content: "Support various formats like JSON, XML, etc." });
    const diags = noVagueLanguageRule.run(makeContext(spec));
    expect(diags.length).toBeGreaterThan(0);
    expect(diags.some((d) => d.message.includes("etc."))).toBe(true);
  });

  it("flags multiple vague patterns", () => {
    const spec = makeSpec({ content: "Simply handle edge cases as needed." });
    const diags = noVagueLanguageRule.run(makeContext(spec));
    expect(diags.length).toBeGreaterThanOrEqual(3);
  });

  it("passes clean content with no vague language", () => {
    const spec = makeSpec({
      content:
        "The system must validate user input before persisting it to the database. " +
        "All requests must complete within 200ms under normal load.",
    });
    const diags = noVagueLanguageRule.run(makeContext(spec));
    expect(diags).toHaveLength(0);
  });

  it("passes empty content", () => {
    const spec = makeSpec({ content: "" });
    const diags = noVagueLanguageRule.run(makeContext(spec));
    expect(diags).toHaveLength(0);
  });
});

describe("staleness-check", () => {
  it("warns when downstream spec is older than upstream dependency", () => {
    const upstream = makeSpec({
      filePath: "specs/prd.md",
      frontmatter: {
        id: "prd-001",
        type: "prd",
        title: "PRD",
        status: "draft",
        version: "1.0",
        created: "2026-01-01",
        updated: "2026-03-01",
        authors: ["dev"],
      },
      content: "",
    });
    const downstream = makeSpec({
      filePath: "specs/tech.md",
      frontmatter: {
        id: "tech-001",
        type: "technical-design",
        title: "Tech Design",
        status: "draft",
        version: "1.0",
        created: "2026-01-01",
        updated: "2026-02-01",
        authors: ["dev"],
        references: [{ id: "prd-001", relationship: "depends-on" as const }],
      },
      content: "",
    });
    const diags = stalenessCheckRule.run(makeContext(downstream, [downstream, upstream]));
    expect(diags.length).toBe(1);
    expect(diags[0]!.ruleId).toBe("freshness/staleness-check");
    expect(diags[0]!.severity).toBe("warn");
    expect(diags[0]!.message).toContain("prd-001");
  });

  it("passes when downstream was updated after upstream", () => {
    const upstream = makeSpec({
      filePath: "specs/prd.md",
      frontmatter: {
        id: "prd-001",
        type: "prd",
        title: "PRD",
        status: "draft",
        version: "1.0",
        created: "2026-01-01",
        updated: "2026-01-15",
        authors: ["dev"],
      },
      content: "",
    });
    const downstream = makeSpec({
      filePath: "specs/tech.md",
      frontmatter: {
        id: "tech-001",
        type: "technical-design",
        title: "Tech Design",
        status: "draft",
        version: "1.0",
        created: "2026-01-01",
        updated: "2026-02-01",
        authors: ["dev"],
        references: [{ id: "prd-001", relationship: "depends-on" as const }],
      },
      content: "",
    });
    const diags = stalenessCheckRule.run(makeContext(downstream, [downstream, upstream]));
    expect(diags).toHaveLength(0);
  });

  it("passes when spec has no references", () => {
    const spec = makeSpec();
    const diags = stalenessCheckRule.run(makeContext(spec));
    expect(diags).toHaveLength(0);
  });

  it("skips references that are not depends-on or implemented-by", () => {
    const upstream = makeSpec({
      filePath: "specs/prd.md",
      frontmatter: {
        id: "prd-001",
        type: "prd",
        title: "PRD",
        status: "draft",
        version: "1.0",
        created: "2026-01-01",
        updated: "2026-03-01",
        authors: ["dev"],
      },
      content: "",
    });
    const downstream = makeSpec({
      filePath: "specs/tech.md",
      frontmatter: {
        id: "tech-001",
        type: "technical-design",
        title: "Tech Design",
        status: "draft",
        version: "1.0",
        created: "2026-01-01",
        updated: "2026-01-01",
        authors: ["dev"],
        references: [{ id: "prd-001", relationship: "related-to" as const }],
      },
      content: "",
    });
    const diags = stalenessCheckRule.run(makeContext(downstream, [downstream, upstream]));
    expect(diags).toHaveLength(0);
  });

  it("uses created date when updated is not present", () => {
    const upstream = makeSpec({
      filePath: "specs/prd.md",
      frontmatter: {
        id: "prd-001",
        type: "prd",
        title: "PRD",
        status: "draft",
        version: "1.0",
        created: "2026-03-01",
        authors: ["dev"],
      },
      content: "",
    });
    const downstream = makeSpec({
      filePath: "specs/tech.md",
      frontmatter: {
        id: "tech-001",
        type: "technical-design",
        title: "Tech Design",
        status: "draft",
        version: "1.0",
        created: "2026-01-01",
        authors: ["dev"],
        references: [{ id: "prd-001", relationship: "implemented-by" as const }],
      },
      content: "",
    });
    const diags = stalenessCheckRule.run(makeContext(downstream, [downstream, upstream]));
    expect(diags.length).toBe(1);
    expect(diags[0]!.message).toContain("prd-001");
  });
});

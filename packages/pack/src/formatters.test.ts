import { describe, it, expect } from "vitest";
import { formatXml } from "./formatters/xml.js";
import { formatMarkdown } from "./formatters/markdown.js";
import { formatJson } from "./formatters/json.js";
import type { CompressedSpec, PackStats } from "./types.js";

function makeCompressedSpec(overrides?: Partial<CompressedSpec>): CompressedSpec {
  return {
    specId: "prd-001",
    type: "prd",
    title: "Product Requirements",
    sections: [
      {
        heading: "Features",
        content: "Feature content",
        tokens: 50,
        compressed: false,
        originalTokens: 50,
      },
      {
        heading: "Data Model",
        content: "[Unchanged since 2025-01-01]",
        tokens: 10,
        compressed: true,
        originalTokens: 100,
      },
    ],
    collapsed: false,
    ...overrides,
  };
}

function defaultStats(overrides?: Partial<PackStats>): PackStats {
  return {
    budget: 12000,
    used: 500,
    specsIncluded: 1,
    specsExcluded: 0,
    sectionsCompressed: 1,
    allocations: [
      {
        specId: "prd-001",
        type: "prd",
        relevance: 0.92,
        tokens: 500,
        compressed: false,
        included: true,
      },
    ],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// XML formatter
// ---------------------------------------------------------------------------
describe("formatXml", () => {
  it("wraps output in a <context> root element with budget attributes", () => {
    const xml = formatXml([makeCompressedSpec()], defaultStats());
    expect(xml).toContain('<context budget="12000" used="500"');
    expect(xml).toContain("</context>");
  });

  it("includes specs and compressed counts on the context element", () => {
    const xml = formatXml([makeCompressedSpec()], defaultStats());
    expect(xml).toContain('specs="1"');
    expect(xml).toContain('compressed="1"');
  });

  it("renders spec elements with id, type, relevance, and tokens", () => {
    const xml = formatXml([makeCompressedSpec()], defaultStats());
    expect(xml).toContain('id="prd-001"');
    expect(xml).toContain('type="prd"');
    expect(xml).toContain('relevance="0.92"');
    expect(xml).toContain('tokens="500"');
  });

  it("renders section elements with name attribute", () => {
    const xml = formatXml([makeCompressedSpec()], defaultStats());
    expect(xml).toContain('name="Features"');
    expect(xml).toContain("Feature content");
  });

  it("marks compressed sections with compressed attribute", () => {
    const xml = formatXml([makeCompressedSpec()], defaultStats());
    expect(xml).toContain('compressed="true"');
    expect(xml).toContain("[Unchanged since 2025-01-01]");
  });

  it("renders collapsed ADRs with a summary instead of sections", () => {
    const spec = makeCompressedSpec({
      specId: "adr-005",
      type: "adr",
      collapsed: true,
      collapsedSummary: "Decided to use PostgreSQL",
      sections: [],
    });
    const stats = defaultStats({
      allocations: [
        {
          specId: "adr-005",
          type: "adr",
          relevance: 0.4,
          tokens: 20,
          compressed: true,
          included: true,
        },
      ],
    });
    const xml = formatXml([spec], stats);
    expect(xml).toContain('collapsed="true"');
    expect(xml).toContain("Decided to use PostgreSQL");
    expect(xml).not.toContain("<section");
  });

  it("escapes XML special characters in content", () => {
    const spec = makeCompressedSpec({
      sections: [
        {
          heading: "Rules & Policies",
          content: 'Use <b> tags & "quotes"',
          tokens: 10,
          compressed: false,
          originalTokens: 10,
        },
      ],
    });
    const xml = formatXml([spec], defaultStats());
    expect(xml).toContain("Rules &amp; Policies");
    expect(xml).toContain("Use &lt;b&gt; tags &amp; &quot;quotes&quot;");
  });
});

// ---------------------------------------------------------------------------
// Markdown formatter
// ---------------------------------------------------------------------------
describe("formatMarkdown", () => {
  it("renders H1 per spec with type and relevance", () => {
    const md = formatMarkdown([makeCompressedSpec()], defaultStats());
    expect(md).toContain("# prd-001 (prd) [relevance: 0.92]");
  });

  it("renders H2 per section", () => {
    const md = formatMarkdown([makeCompressedSpec()], defaultStats());
    expect(md).toContain("## Features");
    expect(md).toContain("## Data Model");
  });

  it("includes section content after the heading", () => {
    const md = formatMarkdown([makeCompressedSpec()], defaultStats());
    expect(md).toContain("Feature content");
  });

  it("separates specs with horizontal rules", () => {
    const spec2 = makeCompressedSpec({
      specId: "tech-001",
      type: "technical-design",
    });
    const stats = defaultStats({
      specsIncluded: 2,
      allocations: [
        ...defaultStats().allocations,
        {
          specId: "tech-001",
          type: "technical-design",
          relevance: 0.78,
          tokens: 300,
          compressed: false,
          included: true,
        },
      ],
    });
    const md = formatMarkdown([makeCompressedSpec(), spec2], stats);
    expect(md).toContain("---");
  });

  it("renders collapsed ADRs with summary instead of sections", () => {
    const spec = makeCompressedSpec({
      specId: "adr-005",
      type: "adr",
      collapsed: true,
      collapsedSummary: "Decided to use PostgreSQL",
      sections: [],
    });
    const stats = defaultStats({
      allocations: [
        {
          specId: "adr-005",
          type: "adr",
          relevance: 0.4,
          tokens: 20,
          compressed: true,
          included: true,
        },
      ],
    });
    const md = formatMarkdown([spec], stats);
    expect(md).toContain("Decided to use PostgreSQL");
    expect(md).not.toContain("## ");
  });
});

// ---------------------------------------------------------------------------
// JSON formatter
// ---------------------------------------------------------------------------
describe("formatJson", () => {
  it("produces valid JSON", () => {
    const json = formatJson([makeCompressedSpec()], defaultStats());
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("includes budget and used at the root", () => {
    const json = formatJson([makeCompressedSpec()], defaultStats());
    const parsed = JSON.parse(json) as Record<string, unknown>;
    expect(parsed["budget"]).toBe(12000);
    expect(parsed["used"]).toBe(500);
  });

  it("includes a specs array with id, type, relevance, tokens, and sections", () => {
    const json = formatJson([makeCompressedSpec()], defaultStats());
    const parsed = JSON.parse(json) as {
      specs: Array<{
        id: string;
        type: string;
        relevance: number;
        tokens: number;
        collapsed: boolean;
        sections: Array<{
          name: string;
          content: string;
          compressed: boolean;
        }>;
      }>;
    };
    expect(parsed.specs).toHaveLength(1);
    const spec = parsed.specs[0]!;
    expect(spec.id).toBe("prd-001");
    expect(spec.type).toBe("prd");
    expect(spec.relevance).toBe(0.92);
    expect(spec.tokens).toBe(500);
    expect(spec.collapsed).toBe(false);
    expect(spec.sections).toHaveLength(2);
    expect(spec.sections[0]!.name).toBe("Features");
    expect(spec.sections[0]!.content).toBe("Feature content");
    expect(spec.sections[0]!.compressed).toBe(false);
    expect(spec.sections[1]!.compressed).toBe(true);
  });

  it("renders collapsed ADRs with a summary field", () => {
    const spec = makeCompressedSpec({
      specId: "adr-005",
      type: "adr",
      collapsed: true,
      collapsedSummary: "Decided to use PostgreSQL",
      sections: [],
    });
    const stats = defaultStats({
      allocations: [
        {
          specId: "adr-005",
          type: "adr",
          relevance: 0.4,
          tokens: 20,
          compressed: true,
          included: true,
        },
      ],
    });
    const json = formatJson([spec], stats);
    const parsed = JSON.parse(json) as {
      specs: Array<{
        collapsed: boolean;
        summary: string;
        sections: unknown[];
      }>;
    };
    const s = parsed.specs[0]!;
    expect(s.collapsed).toBe(true);
    expect(s.summary).toBe("Decided to use PostgreSQL");
    expect(s.sections).toHaveLength(0);
  });
});

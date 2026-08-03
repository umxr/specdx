import { describe, it, expect } from "vitest";
import { buildRelationResolver } from "./relations.js";
import type { SdxConfig } from "@specdx/schema";

function spec(id: string, references?: { id: string; relationship: string }[]) {
  return { frontmatter: { id, ...(references ? { references } : {}) } };
}

const config = {
  version: "1.0",
  specs: {
    prd: { path: "specs/prd.md", type: "prd" },
    design: { path: "specs/design.md", type: "technical-design", requires: ["prd"] },
    stories: { path: "specs/stories/*.md", type: "user-story", requires: ["prd"] },
  },
} as unknown as SdxConfig;

describe("buildRelationResolver", () => {
  it("maps config requires from entry keys into spec id space", () => {
    const byEntry = new Map([
      ["prd", [spec("prd-001")]],
      ["design", [spec("design-001")]],
      ["stories", []],
    ]);
    const relations = buildRelationResolver(config, byEntry);

    expect(relations.edges).toContainEqual({
      from: "prd-001",
      to: "design-001",
      source: "requires",
    });
    expect(relations.getDownstream("prd-001")).toContain("design-001");
    expect(relations.getUpstream("design-001")).toContain("prd-001");
  });

  it("expands a glob entry into one edge per spec id", () => {
    const byEntry = new Map([
      ["prd", [spec("prd-001")]],
      ["design", []],
      ["stories", [spec("story-f1"), spec("story-f2")]],
    ]);
    const relations = buildRelationResolver(config, byEntry);

    expect(relations.getDownstream("prd-001").sort()).toEqual(["story-f1", "story-f2"]);
  });

  it("includes dependency-implying frontmatter references", () => {
    const byEntry = new Map([
      ["prd", [spec("prd-001")]],
      ["design", [spec("design-001", [{ id: "prd-001", relationship: "depends-on" }])]],
      ["stories", []],
    ]);
    const noRequires = {
      version: "1.0",
      specs: {
        prd: { path: "specs/prd.md", type: "prd" },
        design: { path: "specs/design.md", type: "technical-design" },
      },
    } as unknown as SdxConfig;

    const relations = buildRelationResolver(noRequires, byEntry);
    expect(relations.getDownstream("prd-001")).toContain("design-001");
    expect(relations.edges[0]!.source).toBe("references");
  });

  it("honours implemented-by in the reverse direction", () => {
    const byEntry = new Map([
      ["prd", [spec("prd-001", [{ id: "design-001", relationship: "implemented-by" }])]],
      ["design", [spec("design-001")]],
    ]);
    const cfg = {
      version: "1.0",
      specs: {
        prd: { path: "a.md", type: "prd" },
        design: { path: "b.md", type: "technical-design" },
      },
    } as unknown as SdxConfig;

    // prd implemented-by design => design depends on prd
    const relations = buildRelationResolver(cfg, byEntry);
    expect(relations.getDownstream("prd-001")).toContain("design-001");
  });

  it("excludes structural relationships (issue #13)", () => {
    const cfg = {
      version: "1.0",
      specs: {
        epic: { path: "a.md", type: "epic" },
        design: { path: "b.md", type: "technical-design" },
      },
    } as unknown as SdxConfig;
    const byEntry = new Map([
      ["epic", [spec("epic-001", [{ id: "design-001", relationship: "decomposed-into" }])]],
      ["design", [spec("design-001", [{ id: "epic-001", relationship: "related-to" }])]],
    ]);

    const relations = buildRelationResolver(cfg, byEntry);
    expect(relations.edges).toEqual([]);
  });

  it("marks an edge declared in both places as source both", () => {
    const byEntry = new Map([
      ["prd", [spec("prd-001")]],
      ["design", [spec("design-001", [{ id: "prd-001", relationship: "depends-on" }])]],
      ["stories", []],
    ]);
    const relations = buildRelationResolver(config, byEntry);

    const edge = relations.edges.find((e) => e.from === "prd-001" && e.to === "design-001");
    expect(edge?.source).toBe("both");
    // and it is one edge, not two
    expect(
      relations.edges.filter((e) => e.from === "prd-001" && e.to === "design-001"),
    ).toHaveLength(1);
  });

  it("resolves transitively", () => {
    const cfg = {
      version: "1.0",
      specs: {
        a: { path: "a.md", type: "prd" },
        b: { path: "b.md", type: "technical-design", requires: ["a"] },
        c: { path: "c.md", type: "test-plan", requires: ["b"] },
      },
    } as unknown as SdxConfig;
    const byEntry = new Map([
      ["a", [spec("a-1")]],
      ["b", [spec("b-1")]],
      ["c", [spec("c-1")]],
    ]);

    const relations = buildRelationResolver(cfg, byEntry);
    expect(relations.getDownstream("a-1").sort()).toEqual(["b-1", "c-1"]);
    expect(relations.getUpstream("c-1").sort()).toEqual(["a-1", "b-1"]);
  });

  it("ignores references to specs outside the suite", () => {
    const cfg = {
      version: "1.0",
      specs: { design: { path: "b.md", type: "technical-design" } },
    } as unknown as SdxConfig;
    const byEntry = new Map([
      ["design", [spec("design-001", [{ id: "ghost", relationship: "depends-on" }])]],
    ]);

    expect(buildRelationResolver(cfg, byEntry).edges).toEqual([]);
  });
});

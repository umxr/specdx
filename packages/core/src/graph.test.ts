import { describe, it, expect } from "vitest";
import {
  buildGraph,
  GraphError,
  collectReferenceEdges,
  findUnreflectedReferences,
} from "./graph.js";
import type { SdxConfig } from "@specdx/schema";

const makeConfig = (specs: SdxConfig["specs"]): SdxConfig => ({ version: "1.0", specs });

describe("buildGraph", () => {
  it("builds a graph from spec dependencies", () => {
    const config = makeConfig({
      prd: { path: "specs/prd.md", type: "prd" },
      technical: { path: "specs/tech.md", type: "technical-design", requires: ["prd"] },
      stories: { path: "specs/stories/*.md", type: "user-story", requires: ["prd"] },
      testplan: { path: "specs/tp.md", type: "test-plan", requires: ["technical", "stories"] },
    });
    const graph = buildGraph(config);
    expect(graph.nodes).toHaveLength(4);
    expect(graph.edges).toContainEqual({ from: "prd", to: "technical" });
    expect(graph.edges).toContainEqual({ from: "prd", to: "stories" });
  });

  it("returns topologically sorted nodes", () => {
    const config = makeConfig({
      prd: { path: "specs/prd.md", type: "prd" },
      technical: { path: "specs/tech.md", type: "technical-design", requires: ["prd"] },
      testplan: { path: "specs/tp.md", type: "test-plan", requires: ["technical"] },
    });
    const graph = buildGraph(config);
    const sorted = graph.topologicalSort();
    expect(sorted.indexOf("prd")).toBeLessThan(sorted.indexOf("technical"));
    expect(sorted.indexOf("technical")).toBeLessThan(sorted.indexOf("testplan"));
  });

  it("detects circular dependencies", () => {
    const config = makeConfig({
      a: { path: "specs/a.md", type: "prd", requires: ["b"] },
      b: { path: "specs/b.md", type: "prd", requires: ["a"] },
    });
    expect(() => buildGraph(config)).toThrow(GraphError);
    expect(() => buildGraph(config)).toThrow(/circular/i);
  });

  it("returns downstream dependents of a node", () => {
    const config = makeConfig({
      prd: { path: "specs/prd.md", type: "prd" },
      technical: { path: "specs/tech.md", type: "technical-design", requires: ["prd"] },
      stories: { path: "specs/stories/*.md", type: "user-story", requires: ["prd"] },
    });
    const graph = buildGraph(config);
    const downstream = graph.getDownstream("prd");
    expect(downstream).toContain("technical");
    expect(downstream).toContain("stories");
  });

  it("validates that requires references exist", () => {
    const config = makeConfig({
      prd: { path: "specs/prd.md", type: "prd", requires: ["nonexistent"] },
    });
    expect(() => buildGraph(config)).toThrow(GraphError);
  });
});

describe("collectReferenceEdges", () => {
  it("collects typed reference edges from frontmatter", () => {
    const specs = [
      {
        frontmatter: {
          id: "crawler-logger",
          references: [{ id: "project-context", relationship: "depends-on" }],
        },
      },
      { frontmatter: { id: "project-context" } },
    ];
    const edges = collectReferenceEdges(specs);
    expect(edges).toEqual([
      { fromId: "crawler-logger", toId: "project-context", relationship: "depends-on" },
    ]);
  });

  it("ignores malformed reference entries", () => {
    const specs = [
      { frontmatter: { id: "a", references: [null, "b", { relationship: "depends-on" }] } },
    ];
    expect(collectReferenceEdges(specs)).toEqual([]);
  });
});

describe("findUnreflectedReferences", () => {
  const config = {
    version: "1.0",
    specs: {
      ctx: { path: "specs/ctx.md", type: "project-context" },
      design: { path: "specs/design.md", type: "technical-design" },
    },
  } as never;

  const idToEntry = new Map([
    ["project-context", "ctx"],
    ["crawler-logger", "design"],
  ]);

  it("flags a depends-on reference missing from config requires", () => {
    const graph = buildGraph(config);
    const missing = findUnreflectedReferences(
      [{ fromId: "crawler-logger", toId: "project-context", relationship: "depends-on" }],
      idToEntry,
      graph,
    );
    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({ requiringEntry: "design", requiredEntry: "ctx" });
  });

  it("does not flag references the config already reflects", () => {
    const withRequires = {
      version: "1.0",
      specs: {
        ctx: { path: "specs/ctx.md", type: "project-context" },
        design: { path: "specs/design.md", type: "technical-design", requires: ["ctx"] },
      },
    } as never;
    const graph = buildGraph(withRequires);
    const missing = findUnreflectedReferences(
      [{ fromId: "crawler-logger", toId: "project-context", relationship: "depends-on" }],
      idToEntry,
      graph,
    );
    expect(missing).toHaveLength(0);
  });

  it("does not treat decomposed-into as dependency-implying (issue #13)", () => {
    // An epic decomposed into a design does not mean the design
    // build-depends on the epic — no requires suggestion should result.
    const withRequires = {
      version: "1.0",
      specs: {
        ctx: { path: "specs/ctx.md", type: "project-context" },
        design: { path: "specs/design.md", type: "technical-design" },
        epic: { path: "specs/epic.md", type: "epic", requires: ["design"] },
      },
    } as never;
    const graph = buildGraph(withRequires);
    const entries = new Map([
      ["project-context", "ctx"],
      ["crawler-logger", "design"],
      ["content-calendar", "epic"],
    ]);
    const missing = findUnreflectedReferences(
      [{ fromId: "content-calendar", toId: "crawler-logger", relationship: "decomposed-into" }],
      entries,
      graph,
    );
    expect(missing).toHaveLength(0);
  });

  it("marks suggestions that would create a cycle instead of recommending them (issue #13)", () => {
    // Config already has design → epic (epic requires design). A depends-on
    // reference implying epic → design would close a cycle.
    const withRequires = {
      version: "1.0",
      specs: {
        design: { path: "specs/design.md", type: "technical-design" },
        epic: { path: "specs/epic.md", type: "epic", requires: ["design"] },
      },
    } as never;
    const graph = buildGraph(withRequires);
    const entries = new Map([
      ["crawler-logger", "design"],
      ["content-calendar", "epic"],
    ]);
    const missing = findUnreflectedReferences(
      [{ fromId: "crawler-logger", toId: "content-calendar", relationship: "depends-on" }],
      entries,
      graph,
    );
    expect(missing).toHaveLength(1);
    expect(missing[0]!.createsCycle).toBe(true);
  });

  it("marks safe suggestions as not cycle-creating", () => {
    const config2 = {
      version: "1.0",
      specs: {
        ctx: { path: "specs/ctx.md", type: "project-context" },
        design: { path: "specs/design.md", type: "technical-design" },
      },
    } as never;
    const graph = buildGraph(config2);
    const missing = findUnreflectedReferences(
      [{ fromId: "crawler-logger", toId: "project-context", relationship: "depends-on" }],
      idToEntry,
      graph,
    );
    expect(missing).toHaveLength(1);
    expect(missing[0]!.createsCycle).toBe(false);
  });

  it("skips non-dependency relationships and unmapped ids", () => {
    const graph = buildGraph(config);
    const missing = findUnreflectedReferences(
      [
        { fromId: "crawler-logger", toId: "project-context", relationship: "related-to" },
        { fromId: "unknown-id", toId: "project-context", relationship: "depends-on" },
      ],
      idToEntry,
      graph,
    );
    expect(missing).toHaveLength(0);
  });
});

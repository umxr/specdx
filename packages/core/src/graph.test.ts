import { describe, it, expect } from "vitest";
import { buildGraph, GraphError } from "./graph.js";
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

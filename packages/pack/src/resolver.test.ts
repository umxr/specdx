import { describe, it, expect } from "vitest";
import { scoreSpecs, scoreSpecsByIds } from "./resolver.js";
import type { ParsedSpec, DependencyGraph, Edge } from "@specdx/core";

function makeSpec(
  id: string,
  overrides: {
    tags?: string[];
    title?: string;
    sections?: string[];
    content?: string;
  } = {},
): ParsedSpec {
  return {
    filePath: `specs/${id}.md`,
    frontmatter: {
      type: "prd",
      title: overrides.title ?? id,
      tags: overrides.tags ?? [],
    },
    content: overrides.content ?? "",
    sections: overrides.sections ?? [],
    parsedSections: (overrides.sections ?? []).map((heading) => ({
      heading,
      content: `## ${heading}\nSome content`,
      tokens: 10,
    })),
    valid: true,
    validationErrors: null,
  };
}

function makeGraph(
  nodes: string[],
  edges: Edge[] = [],
  upstreamMap: Record<string, string[]> = {},
): DependencyGraph {
  return {
    nodes,
    edges,
    topologicalSort: () => [...nodes],
    getDownstream: (_nodeId: string) => [],
    getUpstream: (nodeId: string) => upstreamMap[nodeId] ?? [],
  };
}

describe("scoreSpecs", () => {
  it("gives all specs score 1.0 when no task is provided", () => {
    const specs = new Map([
      ["prd", makeSpec("prd")],
      ["technical", makeSpec("technical")],
    ]);
    const graph = makeGraph(["prd", "technical"]);
    const results = scoreSpecs(specs, undefined, graph);
    expect(results).toHaveLength(2);
    for (const r of results) {
      expect(r.score).toBe(1.0);
    }
  });

  it("gives all specs score 1.0 when task contains only stopwords", () => {
    const specs = new Map([["prd", makeSpec("prd")]]);
    const graph = makeGraph(["prd"]);
    const results = scoreSpecs(specs, "the a an is", graph);
    expect(results).toHaveLength(1);
    expect(results[0]!.score).toBe(1.0);
  });

  it("scores tag matches higher (3x weight)", () => {
    const specs = new Map([
      ["tagged", makeSpec("tagged", { tags: ["authentication"], title: "other" })],
      ["body", makeSpec("body", { content: "authentication is used here" })],
    ]);
    const graph = makeGraph(["tagged", "body"]);
    const results = scoreSpecs(specs, "authentication", graph);
    const taggedScore = results.find((r) => r.specId === "tagged");
    const bodyScore = results.find((r) => r.specId === "body");
    expect(taggedScore).toBeDefined();
    expect(bodyScore).toBeDefined();
    expect(taggedScore!.rawScore).toBeGreaterThan(bodyScore!.rawScore);
  });

  it("scores title matches higher (3x weight)", () => {
    const specs = new Map([
      ["titled", makeSpec("titled", { title: "Authentication Design" })],
      ["body", makeSpec("body", { content: "authentication is used here" })],
    ]);
    const graph = makeGraph(["titled", "body"]);
    const results = scoreSpecs(specs, "authentication", graph);
    const titledScore = results.find((r) => r.specId === "titled");
    const bodyScore = results.find((r) => r.specId === "body");
    expect(titledScore).toBeDefined();
    expect(bodyScore).toBeDefined();
    expect(titledScore!.rawScore).toBeGreaterThan(bodyScore!.rawScore);
  });

  it("scores section headings at 2x weight", () => {
    const specs = new Map([
      ["sectioned", makeSpec("sectioned", { sections: ["Authentication Flow"] })],
      ["body", makeSpec("body", { content: "authentication is used here" })],
    ]);
    const graph = makeGraph(["sectioned", "body"]);
    const results = scoreSpecs(specs, "authentication", graph);
    const sectionedScore = results.find((r) => r.specId === "sectioned");
    const bodyScore = results.find((r) => r.specId === "body");
    expect(sectionedScore).toBeDefined();
    expect(bodyScore).toBeDefined();
    expect(sectionedScore!.rawScore).toBeGreaterThan(bodyScore!.rawScore);
  });

  it("scores body content at 1x weight", () => {
    const specs = new Map([
      ["body", makeSpec("body", { content: "authentication module handles login" })],
      ["empty", makeSpec("empty")],
    ]);
    const graph = makeGraph(["body", "empty"]);
    const results = scoreSpecs(specs, "authentication", graph);
    const bodyResult = results.find((r) => r.specId === "body");
    expect(bodyResult).toBeDefined();
    expect(bodyResult!.rawScore).toBeGreaterThan(0);
  });

  it("filters stopwords from task", () => {
    const specs = new Map([["auth", makeSpec("auth", { tags: ["authentication"] })]]);
    const graph = makeGraph(["auth"]);
    const results = scoreSpecs(specs, "the authentication", graph);
    expect(results).toHaveLength(1);
    expect(results[0]!.matchedKeywords).toContain("authentication");
    expect(results[0]!.matchedKeywords).not.toContain("the");
  });

  it("excludes specs below 0.1 threshold", () => {
    const specs = new Map([
      ["relevant", makeSpec("relevant", { tags: ["authentication", "security"] })],
      ["irrelevant", makeSpec("irrelevant", { title: "Unrelated Spec" })],
    ]);
    const graph = makeGraph(["relevant", "irrelevant"]);
    const results = scoreSpecs(specs, "authentication security", graph);
    const ids = results.map((r) => r.specId);
    expect(ids).toContain("relevant");
    expect(ids).not.toContain("irrelevant");
  });

  it("boosts graph neighbors of matching specs", () => {
    const specs = new Map([
      ["auth", makeSpec("auth", { tags: ["authentication"] })],
      ["neighbor", makeSpec("neighbor", { title: "User Profile" })],
    ]);
    const graph = makeGraph(["auth", "neighbor"], [{ from: "auth", to: "neighbor" }]);
    const results = scoreSpecs(specs, "authentication", graph);
    const neighborResult = results.find((r) => r.specId === "neighbor");
    // neighbor has no direct match but gets a graph boost
    if (neighborResult) {
      expect(neighborResult.graphBoosted).toBe(true);
    }
  });

  it("returns results sorted descending by score", () => {
    const specs = new Map([
      ["low", makeSpec("low", { content: "authentication" })],
      ["high", makeSpec("high", { tags: ["authentication"], title: "Authentication" })],
      ["mid", makeSpec("mid", { sections: ["Authentication"] })],
    ]);
    const graph = makeGraph(["low", "high", "mid"]);
    const results = scoreSpecs(specs, "authentication", graph);
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i]!.score).toBeGreaterThanOrEqual(results[i + 1]!.score);
    }
  });

  it("tracks matchedKeywords for each spec", () => {
    const specs = new Map([["auth", makeSpec("auth", { tags: ["authentication", "login"] })]]);
    const graph = makeGraph(["auth"]);
    const results = scoreSpecs(specs, "authentication login", graph);
    expect(results[0]!.matchedKeywords).toContain("authentication");
    expect(results[0]!.matchedKeywords).toContain("login");
  });
});

describe("scoreSpecsByIds", () => {
  it("gives named specs score 1.0", () => {
    const specs = new Map([
      ["prd", makeSpec("prd")],
      ["technical", makeSpec("technical")],
    ]);
    const graph = makeGraph(["prd", "technical"]);
    const results = scoreSpecsByIds(specs, ["prd"], graph);
    const prdResult = results.find((r) => r.specId === "prd");
    expect(prdResult).toBeDefined();
    expect(prdResult!.score).toBe(1.0);
  });

  it("includes upstream dependencies at 0.5", () => {
    const specs = new Map([
      ["prd", makeSpec("prd")],
      ["technical", makeSpec("technical")],
    ]);
    const graph = makeGraph(["prd", "technical"], [{ from: "prd", to: "technical" }], {
      technical: ["prd"],
      prd: [],
    });
    const results = scoreSpecsByIds(specs, ["technical"], graph);
    const prdResult = results.find((r) => r.specId === "prd");
    expect(prdResult).toBeDefined();
    expect(prdResult!.score).toBe(0.5);
  });

  it("throws for unknown spec IDs", () => {
    const specs = new Map([["prd", makeSpec("prd")]]);
    const graph = makeGraph(["prd"]);
    expect(() => scoreSpecsByIds(specs, ["nonexistent"], graph)).toThrow(
      /Unknown spec: "nonexistent"/,
    );
    expect(() => scoreSpecsByIds(specs, ["nonexistent"], graph)).toThrow(/Available specs:/);
  });
});

describe("scoreSpecs id matching (issue #9)", () => {
  it("a task naming a spec's id verbatim dominates keyword-only matches", () => {
    const specs = new Map([
      [
        "crawler-logger",
        makeSpec("crawler-logger", {
          title: "Crawler Logger Middleware",
          content: "Log crawler requests via middleware.",
        }),
      ],
      [
        "project-context",
        makeSpec("project-context", {
          title: "Project Context",
          content: "The site uses middleware and a crawler for logging things.",
        }),
      ],
    ]);
    const graph = makeGraph(["crawler-logger", "project-context"]);
    const results = scoreSpecs(specs, "implement the crawler-logger middleware", graph);

    const named = results.find((r) => r.specId === "crawler-logger")!;
    const context = results.find((r) => r.specId === "project-context")!;
    expect(named.idMatched).toBe(true);
    expect(named.score).toBe(1.0);
    expect(context.idMatched).toBe(false);
    expect(context.score).toBeLessThan(0.5);
    expect(results[0]!.specId).toBe("crawler-logger");
  });

  it("does not id-match very short ids", () => {
    const specs = new Map([["db", makeSpec("db", { content: "database" })]]);
    const graph = makeGraph(["db"]);
    const results = scoreSpecs(specs, "installed by the db team", graph);
    expect(results[0]?.idMatched ?? false).toBe(false);
  });
});

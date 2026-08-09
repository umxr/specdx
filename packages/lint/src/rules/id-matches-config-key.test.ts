import { describe, it, expect } from "vitest";
import { idMatchesConfigKeyRule } from "./id-matches-config-key.js";
import type { ParsedSpec } from "@specdx/core";
import type { SdxConfig } from "@specdx/schema";

const makeSpec = (filePath: string, id: string): ParsedSpec => ({
  filePath,
  frontmatter: {
    id,
    type: "prd",
    title: "Test",
    status: "draft",
    version: "1.0",
    created: "2026-01-01",
    authors: ["dev"],
  },
  content: "",
  sections: [],
  parsedSections: [],
  valid: true,
  validationErrors: null,
});

const makeConfig = (specs: SdxConfig["specs"]): SdxConfig =>
  ({ version: "1.0", specs }) as SdxConfig;

describe("id-matches-config-key", () => {
  // Nothing named this before: `validate` passed, `lint` blamed every spec that
  // referenced the id, and `graph` drew nodes by config key beside edges by
  // frontmatter id -- a node with no edges next to edges from a node that did
  // not exist.
  it("flags a spec whose id differs from its config key", () => {
    const spec = makeSpec("/p/specs/prd.md", "prd-999");
    const config = makeConfig({ "prd-001": { path: "specs/prd.md", type: "prd" } });

    const [diag] = idMatchesConfigKeyRule.run({ spec, allSpecs: [spec], config });
    expect(diag).toBeDefined();
    expect(diag!.severity).toBe("warn");
    expect(diag!.message).toContain("prd-999");
    expect(diag!.message).toContain("prd-001");
    expect(diag!.filePath).toBe("/p/specs/prd.md");
  });

  it("passes when they agree", () => {
    const spec = makeSpec("/p/specs/prd.md", "prd-001");
    const config = makeConfig({ "prd-001": { path: "specs/prd.md", type: "prd" } });
    expect(idMatchesConfigKeyRule.run({ spec, allSpecs: [spec], config })).toEqual([]);
  });

  it("says nothing about a glob entry, whose key names a group not a spec", () => {
    const spec = makeSpec("/p/specs/stories/login.md", "story-login");
    const config = makeConfig({ stories: { path: "specs/stories/*.md", type: "user-story" } });
    expect(idMatchesConfigKeyRule.run({ spec, allSpecs: [spec], config })).toEqual([]);
  });

  it("says nothing when the config is unavailable", () => {
    const spec = makeSpec("/p/specs/prd.md", "prd-999");
    expect(idMatchesConfigKeyRule.run({ spec, allSpecs: [spec] })).toEqual([]);
  });

  it("says nothing when two entries could claim the same filename", () => {
    // Ambiguous, so blaming either one would be a guess.
    const spec = makeSpec("/p/a/prd.md", "prd-999");
    const config = makeConfig({
      "prd-001": { path: "a/prd.md", type: "prd" },
      "prd-002": { path: "b/prd.md", type: "prd" },
    });
    expect(idMatchesConfigKeyRule.run({ spec, allSpecs: [spec], config })).toEqual([]);
  });
});

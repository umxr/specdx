import { describe, it, expect } from "vitest";
import { namingConventionsRule } from "./naming-conventions.js";
import type { ParsedSpec } from "@specdx/core";

const makeSpec = (
  overrides: Partial<ParsedSpec> & { frontmatter: Record<string, unknown> },
): ParsedSpec => ({
  filePath: "specs/test.md",
  content: "",
  sections: [],
  parsedSections: [],
  valid: true,
  validationErrors: null,
  ...overrides,
});

describe("consistency/naming-conventions", () => {
  describe("PRD feature ID pattern", () => {
    it("passes when all features use **F<N>**: pattern", () => {
      const spec = makeSpec({
        frontmatter: {
          id: "prd-001",
          type: "prd",
          title: "Test PRD",
          status: "draft",
          version: "1.0",
          created: "2026-01-01",
          authors: ["dev"],
        },
        content: "## Features\n\n- **F1**: Authentication\n- **F2**: Dashboard\n",
      });
      const diags = namingConventionsRule.run({ spec, allSpecs: [spec] });
      expect(diags).toHaveLength(0);
    });

    it("warns when PRD features are missing **F<N>**: pattern", () => {
      const spec = makeSpec({
        frontmatter: {
          id: "prd-001",
          type: "prd",
          title: "Test PRD",
          status: "draft",
          version: "1.0",
          created: "2026-01-01",
          authors: ["dev"],
        },
        content: "## Features\n\n- Authentication flow\n- Dashboard view\n",
      });
      const diags = namingConventionsRule.run({ spec, allSpecs: [spec] });
      expect(diags).toHaveLength(2);
      expect(diags[0]!.ruleId).toBe("consistency/naming-conventions");
      expect(diags[0]!.severity).toBe("warn");
      expect(diags[0]!.message).toContain("**F<N>**:");
      expect(diags[0]!.message).toContain("Authentication flow");
      expect(diags[1]!.message).toContain("Dashboard view");
    });

    it("warns only for bullets without the pattern (mixed)", () => {
      const spec = makeSpec({
        frontmatter: {
          id: "prd-001",
          type: "prd",
          title: "Test PRD",
          status: "draft",
          version: "1.0",
          created: "2026-01-01",
          authors: ["dev"],
        },
        content: "## Features\n\n- **F1**: Authentication\n- Dashboard view without ID\n",
      });
      const diags = namingConventionsRule.run({ spec, allSpecs: [spec] });
      expect(diags).toHaveLength(1);
      expect(diags[0]!.message).toContain("Dashboard view without ID");
    });

    it("ignores PRDs with no Features section", () => {
      const spec = makeSpec({
        frontmatter: {
          id: "prd-001",
          type: "prd",
          title: "Test PRD",
          status: "draft",
          version: "1.0",
          created: "2026-01-01",
          authors: ["dev"],
        },
        content: "## Overview\n\nThis is a PRD.\n",
      });
      const diags = namingConventionsRule.run({ spec, allSpecs: [spec] });
      expect(diags).toHaveLength(0);
    });

    it("stops checking Features section at the next ## heading", () => {
      const spec = makeSpec({
        frontmatter: {
          id: "prd-001",
          type: "prd",
          title: "Test PRD",
          status: "draft",
          version: "1.0",
          created: "2026-01-01",
          authors: ["dev"],
        },
        content: "## Features\n\n- **F1**: Auth\n\n## Constraints\n\n- No camelCase here\n",
      });
      const diags = namingConventionsRule.run({ spec, allSpecs: [spec] });
      expect(diags).toHaveLength(0);
    });
  });

  describe("user-story ID prefix", () => {
    it("passes when user-story ID starts with 'story-'", () => {
      const spec = makeSpec({
        frontmatter: {
          id: "story-001",
          type: "user-story",
          title: "Login story",
          status: "draft",
          version: "1.0",
          created: "2026-01-01",
          authors: ["dev"],
        },
        content: "As a user I want to log in.",
      });
      const diags = namingConventionsRule.run({ spec, allSpecs: [spec] });
      expect(diags).toHaveLength(0);
    });

    it("warns when user-story ID does not start with 'story-'", () => {
      const spec = makeSpec({
        frontmatter: {
          id: "us-001",
          type: "user-story",
          title: "Login story",
          status: "draft",
          version: "1.0",
          created: "2026-01-01",
          authors: ["dev"],
        },
        content: "As a user I want to log in.",
      });
      const diags = namingConventionsRule.run({ spec, allSpecs: [spec] });
      expect(diags).toHaveLength(1);
      expect(diags[0]!.ruleId).toBe("consistency/naming-conventions");
      expect(diags[0]!.severity).toBe("warn");
      expect(diags[0]!.message).toContain('"us-001"');
      expect(diags[0]!.message).toContain("story-");
    });

    it("warns when user-story ID has no prefix at all", () => {
      const spec = makeSpec({
        frontmatter: {
          id: "login-flow",
          type: "user-story",
          title: "Login story",
          status: "draft",
          version: "1.0",
          created: "2026-01-01",
          authors: ["dev"],
        },
        content: "As a user I want to log in.",
      });
      const diags = namingConventionsRule.run({ spec, allSpecs: [spec] });
      expect(diags).toHaveLength(1);
      expect(diags[0]!.message).toContain('"login-flow"');
    });
  });

  describe("api-contract endpoint casing", () => {
    it("passes when all endpoint paths use kebab-case", () => {
      const spec = makeSpec({
        frontmatter: {
          id: "api-001",
          type: "api-contract",
          title: "User API",
          status: "draft",
          version: "1.0",
          created: "2026-01-01",
          authors: ["dev"],
        },
        content:
          "### GET /api/user-profiles\n\nReturns all user profiles.\n\n### POST /api/auth-tokens\n\nCreates a token.\n",
      });
      const diags = namingConventionsRule.run({ spec, allSpecs: [spec] });
      expect(diags).toHaveLength(0);
    });

    it("warns when endpoint path segments use camelCase", () => {
      const spec = makeSpec({
        frontmatter: {
          id: "api-001",
          type: "api-contract",
          title: "User API",
          status: "draft",
          version: "1.0",
          created: "2026-01-01",
          authors: ["dev"],
        },
        content: "### GET /api/userProfiles\n\nReturns all user profiles.\n",
      });
      const diags = namingConventionsRule.run({ spec, allSpecs: [spec] });
      expect(diags).toHaveLength(1);
      expect(diags[0]!.ruleId).toBe("consistency/naming-conventions");
      expect(diags[0]!.severity).toBe("warn");
      expect(diags[0]!.message).toContain("/api/userProfiles");
      expect(diags[0]!.message).toContain("kebab-case");
      expect(diags[0]!.message).toContain("/api/user-profiles");
    });

    it("warns for each camelCase endpoint separately", () => {
      const spec = makeSpec({
        frontmatter: {
          id: "api-001",
          type: "api-contract",
          title: "User API",
          status: "draft",
          version: "1.0",
          created: "2026-01-01",
          authors: ["dev"],
        },
        content:
          "### GET /api/userProfiles\n\nGet profiles.\n\n### DELETE /api/authTokens\n\nDelete token.\n",
      });
      const diags = namingConventionsRule.run({ spec, allSpecs: [spec] });
      expect(diags).toHaveLength(2);
      expect(diags[0]!.message).toContain("/api/userProfiles");
      expect(diags[1]!.message).toContain("/api/authTokens");
    });
  });

  describe("non-applicable spec types are skipped", () => {
    it("skips adr specs", () => {
      const spec = makeSpec({
        frontmatter: {
          id: "adr-001",
          type: "adr",
          title: "Some Decision",
          status: "draft",
          version: "1.0",
          created: "2026-01-01",
          authors: ["dev"],
        },
        content: "## Features\n\n- No F<N> here\n\n### GET /api/camelCasePath\n",
      });
      const diags = namingConventionsRule.run({ spec, allSpecs: [spec] });
      expect(diags).toHaveLength(0);
    });

    it("skips test-plan specs", () => {
      const spec = makeSpec({
        frontmatter: {
          id: "tp-001",
          type: "test-plan",
          title: "Test Plan",
          status: "draft",
          version: "1.0",
          created: "2026-01-01",
          authors: ["dev"],
        },
        content: "## Features\n\n- No F<N> here\n\n### GET /api/camelCasePath\n",
      });
      const diags = namingConventionsRule.run({ spec, allSpecs: [spec] });
      expect(diags).toHaveLength(0);
    });
  });
});

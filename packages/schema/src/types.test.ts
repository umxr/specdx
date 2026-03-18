import { describe, it, expect } from "vitest";
import type { BaseSpec, UserStorySpec } from "./types.js";
import { SPEC_TYPES, SPEC_STATUSES } from "./types.js";
import { REQUIRED_SECTIONS } from "./sections.js";

describe("types", () => {
  it("exports SPEC_TYPES constant matching the type union", () => {
    expect(SPEC_TYPES).toEqual([
      "prd",
      "technical-design",
      "user-story",
      "test-plan",
      "adr",
      "api-contract",
    ]);
  });

  it("exports SPEC_STATUSES constant", () => {
    expect(SPEC_STATUSES).toEqual(["draft", "review", "approved", "superseded"]);
  });

  it("BaseSpec has required fields", () => {
    const spec: BaseSpec = {
      id: "prd-001",
      type: "prd",
      title: "Test",
      status: "draft",
      version: "1.0",
      created: "2026-01-01",
      authors: ["dev"],
    };
    expect(spec.id).toBe("prd-001");
  });

  it("UserStorySpec requires story_id, priority, estimate", () => {
    const story: UserStorySpec = {
      id: "s-001",
      type: "user-story",
      title: "Login",
      status: "draft",
      version: "1.0",
      created: "2026-01-01",
      authors: ["dev"],
      story_id: "US-001",
      priority: "high",
      estimate: "3",
    };
    expect(story.story_id).toBe("US-001");
  });
});

describe("sections", () => {
  it("defines required sections for PRD", () => {
    expect(REQUIRED_SECTIONS["prd"]).toContain("Problem Statement");
    expect(REQUIRED_SECTIONS["prd"]).toContain("Goals");
    expect(REQUIRED_SECTIONS["prd"]).toContain("Features");
  });

  it("defines required sections for all spec types", () => {
    for (const type of [
      "prd",
      "technical-design",
      "user-story",
      "test-plan",
      "adr",
      "api-contract",
    ] as const) {
      expect(REQUIRED_SECTIONS[type]).toBeDefined();
      expect(REQUIRED_SECTIONS[type]!.length).toBeGreaterThan(0);
    }
  });
});

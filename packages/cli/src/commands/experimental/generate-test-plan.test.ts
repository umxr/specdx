import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateTestPlan } from "./generate-test-plan.js";

describe("generateTestPlan", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "sdx-gen-tp-"));
    await mkdir(join(tempDir, "specs/stories"), { recursive: true });
  });
  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it("generates test plan from story acceptance criteria", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      [
        'version: "1.0"',
        "specs:",
        "  stories:",
        "    path: specs/stories/*.md",
        "    type: user-story",
      ].join("\n"),
    );
    await writeFile(
      join(tempDir, "specs/stories/auth.md"),
      [
        "---",
        'id: "story-auth"',
        'type: "user-story"',
        'title: "Auth"',
        'status: "draft"',
        'version: "1.0"',
        'created: "2026-01-01"',
        'authors: ["dev"]',
        'story_id: "story-auth"',
        'priority: "high"',
        'estimate: "3d"',
        "---",
        "",
        "# Auth",
        "",
        "## Acceptance Criteria",
        "",
        "- [ ] User can log in with email and password",
        "- [ ] Invalid credentials show error message",
        "- [ ] Session persists across page refreshes",
      ].join("\n"),
    );

    const result = await generateTestPlan({ configDir: tempDir });

    expect(result.filePath).toContain("test-plan.md");

    const content = await readFile(result.filePath!, "utf-8");
    expect(content).toContain('type: "test-plan"');
    expect(content).toContain("## Test Cases");
    expect(content).toContain("User can log in with email and password");
    expect(content).toContain("story-auth");
  });

  it("groups test cases by story", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      [
        'version: "1.0"',
        "specs:",
        "  stories:",
        "    path: specs/stories/*.md",
        "    type: user-story",
      ].join("\n"),
    );
    await writeFile(
      join(tempDir, "specs/stories/auth.md"),
      [
        "---",
        'id: "story-auth"',
        'type: "user-story"',
        'title: "Auth"',
        'status: "draft"',
        'version: "1.0"',
        'created: "2026-01-01"',
        'authors: ["dev"]',
        'story_id: "story-auth"',
        'priority: "high"',
        'estimate: "3d"',
        "---",
        "",
        "## Acceptance Criteria",
        "",
        "- [ ] Login works",
      ].join("\n"),
    );
    await writeFile(
      join(tempDir, "specs/stories/profile.md"),
      [
        "---",
        'id: "story-profile"',
        'type: "user-story"',
        'title: "Profile"',
        'status: "draft"',
        'version: "1.0"',
        'created: "2026-01-01"',
        'authors: ["dev"]',
        'story_id: "story-profile"',
        'priority: "medium"',
        'estimate: "2d"',
        "---",
        "",
        "## Acceptance Criteria",
        "",
        "- [ ] User can update name",
        "- [ ] User can upload avatar",
      ].join("\n"),
    );

    const result = await generateTestPlan({ configDir: tempDir });
    expect(result.filePath).toBeDefined();
    const content = await readFile(result.filePath!, "utf-8");
    expect(content).toContain("### story-auth");
    expect(content).toContain("### story-profile");
  });
});

describe("generateTestPlan — refuses to manufacture an empty spec (F2)", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "sdx-gen-tp-empty-"));
    await mkdir(join(dir, "specs/stories"), { recursive: true });
  });
  afterEach(async () => {
    await rm(dir, { recursive: true });
  });

  it("writes no file when there are no stories to build a plan from", async () => {
    await writeFile(
      join(dir, "spec.config.yaml"),
      [
        'version: "1.0"',
        "specs:",
        "  stories:",
        "    path: specs/stories/*.md",
        "    type: user-story",
      ].join("\n"),
    );

    const result = await generateTestPlan({ configDir: dir });

    // Its sibling `generate story` already declines in this situation. Writing
    // a spec whose every section reads "_No user stories found._" -- including
    // a placeholder its own linter flags -- is not a successful generation.
    expect(result.testCases).toBe(0);
    expect(result.filePath).toBeUndefined();
    await expect(readFile(join(dir, "specs/test-plan.md"), "utf-8")).rejects.toThrow();
  });
});

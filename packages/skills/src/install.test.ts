import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { installSkills, SKILL_DIRS } from "./install.js";

describe("installSkills", () => {
  let targetDir: string;

  beforeEach(async () => {
    targetDir = join(
      tmpdir(),
      `sdx-skills-test-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
  });

  afterEach(async () => {
    await rm(targetDir, { recursive: true, force: true });
  });

  it("exports expected SKILL_DIRS list", () => {
    expect(SKILL_DIRS).toContain("specdx-start-task");
    expect(SKILL_DIRS).toContain("specdx-author-spec");
    expect(SKILL_DIRS).toHaveLength(2);
  });

  it("creates skill directories with SKILL.md files", async () => {
    const result = await installSkills(targetDir);

    expect(result.installed).toHaveLength(2);
    expect(result.updated).toHaveLength(0);
    expect(result.installed).toContain("specdx-start-task");
    expect(result.installed).toContain("specdx-author-spec");

    for (const skill of SKILL_DIRS) {
      const content = await readFile(
        join(targetDir, ".claude", "skills", skill, "SKILL.md"),
        "utf-8",
      );
      expect(content.length).toBeGreaterThan(100);
    }
  });

  it("skill files have valid frontmatter", async () => {
    await installSkills(targetDir);

    for (const skill of SKILL_DIRS) {
      const content = await readFile(
        join(targetDir, ".claude", "skills", skill, "SKILL.md"),
        "utf-8",
      );
      expect(content).toMatch(/^---\n/);
      expect(content).toMatch(/name:\s*specdx-/);
      expect(content).toMatch(/description:/);
    }
  });

  it("specdx-start-task references specdx pack command", async () => {
    await installSkills(targetDir);

    const content = await readFile(
      join(targetDir, ".claude", "skills", "specdx-start-task", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("npx specdx pack");
  });

  it("specdx-author-spec references specdx lint command", async () => {
    await installSkills(targetDir);

    const content = await readFile(
      join(targetDir, ".claude", "skills", "specdx-author-spec", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("npx specdx lint");
  });

  it("reports 'updated' on second install", async () => {
    const first = await installSkills(targetDir);
    expect(first.installed).toHaveLength(2);
    expect(first.updated).toHaveLength(0);

    const second = await installSkills(targetDir);
    expect(second.installed).toHaveLength(0);
    expect(second.updated).toHaveLength(2);
  });

  it("overwrites modified files and reports as updated", async () => {
    await installSkills(targetDir);
    const skillPath = join(targetDir, ".claude", "skills", "specdx-start-task", "SKILL.md");

    await writeFile(skillPath, "modified content");

    const result = await installSkills(targetDir);
    expect(result.updated).toContain("specdx-start-task");

    const content = await readFile(skillPath, "utf-8");
    expect(content).not.toBe("modified content");
    expect(content.length).toBeGreaterThan(100);
  });
});

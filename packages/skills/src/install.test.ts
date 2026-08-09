import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { installSkills, SKILL_NAMES, CORE_SKILL_NAMES } from "./install.js";

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

  it("exports expected SKILL_NAMES list", () => {
    expect(SKILL_NAMES).toContain("specdx-start-task");
    expect(SKILL_NAMES).toContain("specdx-author-spec");
    expect(SKILL_NAMES).toContain("specdx-pre-commit");
    expect(SKILL_NAMES).toContain("specdx-sprint-review");
    expect(SKILL_NAMES).toContain("specdx-plan-from-spec");
    expect(SKILL_NAMES).toContain("specdx-onboard");
    expect(SKILL_NAMES).toHaveLength(10);
    expect(CORE_SKILL_NAMES).toHaveLength(8);
    expect(SKILL_NAMES).toContain("specdx-router");
  });

  it("creates skill directories in .claude/skills/", async () => {
    const result = await installSkills(targetDir);

    expect(result.installed).toHaveLength(8);
    expect(result.updated).toHaveLength(0);
    expect(result.installed).toContain("specdx-start-task");
    expect(result.installed).toContain("specdx-author-spec");
    expect(result.installed).toContain("specdx-pre-commit");
    expect(result.installed).toContain("specdx-sprint-review");
    expect(result.installed).toContain("specdx-plan-from-spec");

    for (const skill of CORE_SKILL_NAMES) {
      const content = await readFile(
        join(targetDir, ".claude", "skills", skill, "SKILL.md"),
        "utf-8",
      );
      expect(content.length).toBeGreaterThan(100);
    }
  });

  it("skill files have valid frontmatter", async () => {
    await installSkills(targetDir);

    for (const skill of CORE_SKILL_NAMES) {
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

  it("specdx-author-spec is a step-file dispatcher", async () => {
    await installSkills(targetDir);

    const content = await readFile(
      join(targetDir, ".claude", "skills", "specdx-author-spec", "SKILL.md"),
      "utf-8",
    );
    expect(content).toContain("step-01-frontmatter.md");
  });

  it("reports 'updated' on second install", async () => {
    const first = await installSkills(targetDir);
    expect(first.installed).toHaveLength(8);
    expect(first.updated).toHaveLength(0);

    const second = await installSkills(targetDir);
    expect(second.installed).toHaveLength(0);
    expect(second.updated).toHaveLength(8);
  });

  it("installs only promoted skills by default", async () => {
    const result = await installSkills(targetDir);

    expect(result.installed).not.toContain("specdx-verify");
    expect(result.installed).not.toContain("specdx-check-drift");
    await expect(
      readFile(join(targetDir, ".claude", "skills", "specdx-verify", "SKILL.md"), "utf-8"),
    ).rejects.toThrow();
  });

  it("installs experimental skills when asked", async () => {
    const result = await installSkills(targetDir, { experimental: true });

    expect(result.installed).toHaveLength(10);
    expect(result.installed).toContain("specdx-verify");
    const content = await readFile(
      join(targetDir, ".claude", "skills", "specdx-check-drift", "SKILL.md"),
      "utf-8",
    );
    expect(content.length).toBeGreaterThan(100);
  });

  it("installs bundled reference files alongside SKILL.md", async () => {
    await installSkills(targetDir);

    const reference = await readFile(
      join(
        targetDir,
        ".claude",
        "skills",
        "specdx-author-spec",
        "references",
        "step-01-frontmatter.md",
      ),
      "utf-8",
    );
    expect(reference.length).toBeGreaterThan(100);
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

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { installSkills, SKILL_FILES } from "./install.js";

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

  it("exports expected SKILL_FILES list", () => {
    expect(SKILL_FILES).toContain("sdx-start-task.md");
    expect(SKILL_FILES).toContain("sdx-author-spec.md");
    expect(SKILL_FILES).toHaveLength(2);
  });

  it("creates target directory if it does not exist", async () => {
    const result = await installSkills(targetDir);

    expect(result.installed).toHaveLength(2);
    expect(result.updated).toHaveLength(0);
    expect(result.installed).toContain("sdx-start-task.md");
    expect(result.installed).toContain("sdx-author-spec.md");
  });

  it("copies skill files with real markdown content", async () => {
    await installSkills(targetDir);
    const skillsDir = join(targetDir, ".claude", "skills");

    for (const file of SKILL_FILES) {
      const content = await readFile(join(skillsDir, file), "utf-8");
      // Must have substantive content
      expect(content.length).toBeGreaterThan(100);
      // Must have YAML frontmatter delimiters
      expect(content).toContain("---");
      // Must contain markdown headings
      expect(content).toMatch(/^#/m);
    }
  });

  it("sdx-start-task.md has correct frontmatter name", async () => {
    await installSkills(targetDir);

    const content = await readFile(
      join(targetDir, ".claude", "skills", "sdx-start-task.md"),
      "utf-8",
    );
    expect(content).toMatch(/name:\s*sdx:start-task/);
    expect(content).toMatch(/description:/);
    // Should reference sdx pack command
    expect(content).toContain("sdx pack");
  });

  it("sdx-author-spec.md has correct frontmatter name", async () => {
    await installSkills(targetDir);

    const content = await readFile(
      join(targetDir, ".claude", "skills", "sdx-author-spec.md"),
      "utf-8",
    );
    expect(content).toMatch(/name:\s*sdx:author-spec/);
    expect(content).toMatch(/description:/);
    // Should reference sdx lint command
    expect(content).toContain("sdx lint");
  });

  it("reports 'updated' on second install", async () => {
    const first = await installSkills(targetDir);
    expect(first.installed).toHaveLength(2);
    expect(first.updated).toHaveLength(0);

    const second = await installSkills(targetDir);
    expect(second.installed).toHaveLength(0);
    expect(second.updated).toHaveLength(2);
    expect(second.updated).toContain("sdx-start-task.md");
    expect(second.updated).toContain("sdx-author-spec.md");
  });

  it("installs into nested directory structure", async () => {
    const nested = join(targetDir, "sub", "project");
    const result = await installSkills(nested);

    expect(result.installed).toHaveLength(2);

    const content = await readFile(
      join(nested, ".claude", "skills", "sdx-start-task.md"),
      "utf-8",
    );
    expect(content.length).toBeGreaterThan(100);
  });

  it("overwrites modified files and reports as updated", async () => {
    await installSkills(targetDir);
    const skillsDir = join(targetDir, ".claude", "skills");

    // Modify a file
    await writeFile(join(skillsDir, "sdx-start-task.md"), "modified content");

    const result = await installSkills(targetDir);
    expect(result.updated).toContain("sdx-start-task.md");

    // Should have original content restored
    const content = await readFile(
      join(skillsDir, "sdx-start-task.md"),
      "utf-8",
    );
    expect(content).not.toBe("modified content");
    expect(content.length).toBeGreaterThan(100);
  });
});

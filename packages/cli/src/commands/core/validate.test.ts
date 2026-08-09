import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runValidate } from "./validate.js";

const CWD = process.cwd();

async function writeSpec(dir: string, id: string, type: string): Promise<void> {
  await writeFile(
    join(dir, `specs/${id}.md`),
    [
      "---",
      `id: "${id}"`,
      `type: "${type}"`,
      `title: "${id}"`,
      'status: "draft"',
      'version: "1.0"',
      'created: "2026-07-29"',
      'authors: ["dev"]',
      "---",
      "",
      `# ${id}`,
      "",
      "## Overview",
      "",
      "Content.",
    ].join("\n"),
  );
}

describe("runValidate", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "sdx-validate-test-"));
    await mkdir(join(tempDir, "specs"), { recursive: true });
    process.chdir(tempDir);
  });
  afterEach(async () => {
    process.chdir(CWD);
    await rm(tempDir, { recursive: true });
  });

  it("passes a valid acyclic config", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      [
        'version: "1.0"',
        "specs:",
        "  design:",
        '    path: "specs/design.md"',
        '    type: "technical-design"',
        "  epic:",
        '    path: "specs/epic.md"',
        '    type: "epic"',
        '    requires: ["design"]',
      ].join("\n"),
    );
    await writeSpec(tempDir, "design", "technical-design");
    await writeSpec(tempDir, "epic", "epic");

    const result = await runValidate(tempDir);
    expect(result.valid).toBe(true);
    expect(result.specCount).toBe(2);
  });

  it("fails on a cyclic requires chain (issue #13)", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      [
        'version: "1.0"',
        "specs:",
        "  design:",
        '    path: "specs/design.md"',
        '    type: "technical-design"',
        '    requires: ["epic"]',
        "  epic:",
        '    path: "specs/epic.md"',
        '    type: "epic"',
        '    requires: ["design"]',
      ].join("\n"),
    );
    await writeSpec(tempDir, "design", "technical-design");
    await writeSpec(tempDir, "epic", "epic");

    const result = await runValidate(tempDir);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/circular/i);
  });

  it("fails when a required spec resolves to no files (vacuous-pass audit)", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      [
        'version: "1.0"',
        "specs:",
        "  prd:",
        '    path: "specs/prd.md"',
        '    type: "prd"',
        "    required: true",
      ].join("\n"),
    );

    const result = await runValidate(tempDir);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/resolves to no files|not found/i);
  });

  it("warns, without failing, when an optional glob matches nothing", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      [
        'version: "1.0"',
        "specs:",
        "  design:",
        '    path: "specs/design.md"',
        '    type: "technical-design"',
        "  stories:",
        '    path: "specs/stories/*.md"',
        '    type: "user-story"',
      ].join("\n"),
    );
    await writeSpec(tempDir, "design", "technical-design");

    const result = await runValidate(tempDir);
    expect(result.valid).toBe(true);
    expect(result.specFileCount).toBe(1);
    expect(result.warnings.some((w) => w.includes("stories"))).toBe(true);
  });

  it("warns that the suite is empty when no spec files resolve at all", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      ['version: "1.0"', "specs:", "  prd:", '    path: "specs/*.md"', '    type: "prd"'].join(
        "\n",
      ),
    );

    const result = await runValidate(tempDir);
    expect(result.specFileCount).toBe(0);
    expect(result.warnings.some((w) => /no spec files/i.test(w))).toBe(true);
  });

  it("fails when requires points at a missing entry", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      [
        'version: "1.0"',
        "specs:",
        "  design:",
        '    path: "specs/design.md"',
        '    type: "technical-design"',
        '    requires: ["ghost"]',
      ].join("\n"),
    );
    await writeSpec(tempDir, "design", "technical-design");

    const result = await runValidate(tempDir);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/does not exist/i);
  });
});

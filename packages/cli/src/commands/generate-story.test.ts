import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { generateStories } from "./generate-story.js";

describe("generateStories", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "sdx-gen-story-"));
    await mkdir(join(tempDir, "specs"), { recursive: true });
    await mkdir(join(tempDir, "specs/stories"), { recursive: true });
  });
  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it("generates story stubs from PRD features", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      [
        'version: "1.0"',
        "specs:",
        "  prd:",
        "    path: specs/prd.md",
        "    type: prd",
        "  stories:",
        "    path: specs/stories/*.md",
        "    type: user-story",
        '    requires: ["prd"]',
      ].join("\n"),
    );
    await writeFile(
      join(tempDir, "specs/prd.md"),
      [
        "---",
        'id: "prd-001"',
        'type: "prd"',
        'title: "Test PRD"',
        'status: "approved"',
        'version: "1.0"',
        'created: "2026-01-01"',
        'authors: ["dev"]',
        "---",
        "",
        "# Test PRD",
        "",
        "## Features",
        "",
        "- **F1**: User authentication with email and password",
        "- **F2**: OAuth support for Google and GitHub",
        "- **F3**: Multi-factor authentication via email OTP",
      ].join("\n"),
    );

    const result = await generateStories({ configDir: tempDir, from: "prd-001" });

    expect(result.generated).toHaveLength(3);

    const files = await readdir(join(tempDir, "specs/stories"));
    expect(files).toHaveLength(3);

    const content = await readFile(join(tempDir, "specs/stories", files[0]!), "utf-8");
    expect(content).toContain('type: "user-story"');
    expect(content).toContain("## Description");
    expect(content).toContain("## Acceptance Criteria");
    expect(content).toContain("prd-001");
  });

  it("truncates long filenames on a word boundary, not mid-word", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      [
        'version: "1.0"',
        "specs:",
        "  prd:",
        "    path: specs/prd.md",
        "    type: prd",
        "  stories:",
        "    path: specs/stories/*.md",
        "    type: user-story",
        '    requires: ["prd"]',
      ].join("\n"),
    );
    await writeFile(
      join(tempDir, "specs/prd.md"),
      [
        "---",
        'id: "prd-001"',
        'type: "prd"',
        'title: "Test PRD"',
        'status: "approved"',
        'version: "1.0"',
        'created: "2026-01-01"',
        'authors: ["dev"]',
        "---",
        "",
        "# Test PRD",
        "",
        "## Features",
        "",
        "- **F2**: Spec linting — 13 built-in rules across structure and completeness categories",
      ].join("\n"),
    );

    const result = await generateStories({ configDir: tempDir, from: "prd-001" });

    expect(result.generated).toHaveLength(1);
    const files = await readdir(join(tempDir, "specs/stories"));
    // hard cut at 40 chars would produce "...-rules-across-st.md"
    expect(files[0]).toBe("story-f2-spec-linting-13-built-in-rules-across.md");
  });

  it("returns empty when PRD has no features", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      'version: "1.0"\nspecs:\n  prd:\n    path: specs/prd.md\n    type: prd\n',
    );
    await writeFile(
      join(tempDir, "specs/prd.md"),
      [
        "---",
        'id: "prd-001"',
        'type: "prd"',
        'title: "Empty PRD"',
        'status: "draft"',
        'version: "1.0"',
        'created: "2026-01-01"',
        'authors: ["dev"]',
        "---",
        "",
        "# Empty PRD",
        "",
        "## Features",
        "",
        "No features yet.",
      ].join("\n"),
    );

    const result = await generateStories({ configDir: tempDir, from: "prd-001" });
    expect(result.generated).toHaveLength(0);
  });
});

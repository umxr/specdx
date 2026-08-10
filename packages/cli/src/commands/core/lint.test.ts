import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runLint } from "./lint.js";

describe("runLint", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "sdx-lint-test-"));
    await mkdir(join(tempDir, "specs"), { recursive: true });
  });
  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it("returns diagnostics for a spec with issues", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      `version: "1.0"\nspecs:\n  prd:\n    path: "specs/prd.md"\n    type: "prd"\n`,
    );
    await writeFile(
      join(tempDir, "specs/prd.md"),
      `---\nid: "prd-001"\ntype: "prd"\ntitle: "Test"\nstatus: "draft"\nversion: "1.0"\ncreated: "2026-01-01"\nauthors: ["dev"]\n---\n\n# Test\n\n## Problem Statement\n\nSome content with TBD items.\n`,
    );
    const result = await runLint({ configDir: tempDir });
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it("passes for a well-formed spec", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      `version: "1.0"\nspecs:\n  prd:\n    path: "specs/prd.md"\n    type: "prd"\n`,
    );
    await writeFile(
      join(tempDir, "specs/prd.md"),
      [
        "---",
        'id: "prd-001"',
        'type: "prd"',
        'title: "Test"',
        'status: "draft"',
        'version: "1.0"',
        'created: "2026-01-01"',
        'authors: ["dev"]',
        "---",
        "",
        "# Test",
        "",
        "## Problem Statement",
        "",
        "Users need a solution.",
        "",
        "## Goals",
        "",
        "- Be useful",
        "",
        "## Non-Goals",
        "",
        "- Everything else",
        "",
        "## Features",
        "",
        "- **F1**: Core feature",
        "",
        "## Success Criteria",
        "",
        "- It works",
      ].join("\n"),
    );
    const result = await runLint({ configDir: tempDir });
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    expect(errors).toHaveLength(0);
  });

  it("does not report a vacuous pass when no specs resolve (vacuous-pass audit)", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      `version: "1.0"\nspecs:\n  prd:\n    path: "specs/*.md"\n    type: "prd"\n`,
    );

    const result = await runLint({ configDir: tempDir });
    expect(result.specFiles).toBe(0);
    expect(result.assessed).toBe(false);
  });

  it("marks a suite with specs as assessed", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      `version: "1.0"\nspecs:\n  prd:\n    path: "specs/prd.md"\n    type: "prd"\n`,
    );
    await writeFile(
      join(tempDir, "specs/prd.md"),
      `---\nid: "prd-001"\ntype: "prd"\ntitle: "Test"\nstatus: "draft"\nversion: "1.0"\ncreated: "2026-01-01"\nauthors: ["dev"]\n---\n\n# Test\n\n## Problem Statement\n\nContent.\n`,
    );

    const result = await runLint({ configDir: tempDir });
    expect(result.specFiles).toBe(1);
    expect(result.assessed).toBe(true);
  });

  it("single-file lint still resolves cross-references against the full suite", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      [
        'version: "1.0"',
        "specs:",
        "  design:",
        '    path: "specs/design.md"',
        '    type: "technical-design"',
        "  adr:",
        '    path: "specs/adr.md"',
        '    type: "adr"',
      ].join("\n"),
    );
    await writeFile(
      join(tempDir, "specs/design.md"),
      [
        "---",
        'id: "design-001"',
        'type: "technical-design"',
        'title: "Design"',
        'status: "draft"',
        'version: "1.0"',
        'created: "2026-01-01"',
        'authors: ["dev"]',
        "---",
        "",
        "# Design",
        "",
        "## Overview",
        "",
        "Content.",
      ].join("\n"),
    );
    await writeFile(
      join(tempDir, "specs/adr.md"),
      [
        "---",
        'id: "adr-001"',
        'type: "adr"',
        'title: "A Decision"',
        'status: "draft"',
        'version: "1.0"',
        'created: "2026-01-01"',
        'authors: ["dev"]',
        "references:",
        '  - id: "design-001"',
        '    relationship: "depends-on"',
        "---",
        "",
        "# A Decision",
        "",
        "## Context",
        "",
        "Context here.",
        "",
        "## Decision",
        "",
        "We decided.",
        "",
        "## Status",
        "",
        "Draft.",
        "",
        "## Consequences",
        "",
        "Some consequences.",
      ].join("\n"),
    );

    const result = await runLint({ configDir: tempDir, specPath: "specs/adr.md" });
    const refErrors = result.diagnostics.filter((d) => d.ruleId === "structure/valid-references");
    expect(refErrors).toHaveLength(0);

    // Diagnostics from other files must not leak into single-file results
    expect(result.diagnostics.every((d) => d.filePath.includes("specs/adr.md"))).toBe(true);
  });
});

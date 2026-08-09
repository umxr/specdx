import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runReady } from "./ready.js";

const CWD = process.cwd();

describe("runReady", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "sdx-ready-test-"));
    await mkdir(join(tempDir, "specs"), { recursive: true });
    process.chdir(tempDir);
  });
  afterEach(async () => {
    process.chdir(CWD);
    await rm(tempDir, { recursive: true });
  });

  it("returns ready for a healthy spec suite", async () => {
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
        'title: "Test PRD"',
        'status: "draft"',
        'version: "1.0"',
        `created: "${new Date().toISOString().slice(0, 10)}"`,
        'authors: ["dev"]',
        "---",
        "",
        "# Test PRD",
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
    const result = await runReady();
    expect(result.checks.find((c) => c.name === "Lint health")?.passed).toBe(true);
    expect(result.checks.find((c) => c.name === "No integrity issues")?.passed).toBe(true);
    expect(result.checks.find((c) => c.name === "No stale specs")?.passed).toBe(true);
  });

  it("marks vacuous checks as skipped instead of passed", async () => {
    // A suite with only a quick-spec: no PRD, no required specs, no relations
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      `version: "1.0"\nspecs:\n  qs:\n    path: "specs/qs.md"\n    type: "quick-spec"\n`,
    );
    await writeFile(
      join(tempDir, "specs/qs.md"),
      [
        "---",
        'id: "qs-001"',
        'type: "quick-spec"',
        'title: "Quick"',
        'status: "draft"',
        'version: "1.0"',
        `created: "${new Date().toISOString().slice(0, 10)}"`,
        'authors: ["dev"]',
        "---",
        "",
        "# Quick",
        "",
        "## Intent",
        "",
        "Do a thing.",
        "",
        "## Boundaries",
        "",
        "Only the thing. Errors are reported.",
        "",
        "## Tasks",
        "",
        "- The thing",
      ].join("\n"),
    );
    const result = await runReady();

    const story = result.checks.find((c) => c.name === "Story coverage");
    expect(story?.skipped).toBe(true);
    expect(story?.details).toContain("no PRD");

    const required = result.checks.find((c) => c.name === "Required specs present");
    expect(required?.skipped).toBe(true);

    const integrity = result.checks.find((c) => c.name === "No integrity issues");
    expect(integrity?.skipped).toBe(true);

    // Skipped checks don't block readiness
    expect(result.ready).toBe(true);
  });

  it("does not mark story coverage skipped when a PRD exists", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      `version: "1.0"\nspecs:\n  prd:\n    path: "specs/prd.md"\n    type: "prd"\n    required: true\n`,
    );
    await writeFile(
      join(tempDir, "specs/prd.md"),
      [
        "---",
        'id: "prd-001"',
        'type: "prd"',
        'title: "Test PRD"',
        'status: "draft"',
        'version: "1.0"',
        `created: "${new Date().toISOString().slice(0, 10)}"`,
        'authors: ["dev"]',
        "---",
        "",
        "## Features",
        "",
        "- **F1**: Core feature",
      ].join("\n"),
    );
    const result = await runReady();
    const story = result.checks.find((c) => c.name === "Story coverage");
    expect(story?.skipped).toBeUndefined();
  });

  it("detects missing required specs", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      [
        'version: "1.0"',
        "specs:",
        "  prd:",
        '    path: "specs/prd.md"',
        '    type: "prd"',
        "    required: true",
        "  test-plan:",
        '    path: "specs/test-plan.md"',
        '    type: "test-plan"',
        "    required: true",
      ].join("\n"),
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
        `created: "${new Date().toISOString().slice(0, 10)}"`,
        'authors: ["dev"]',
        "---",
        "",
        "# Test",
        "",
        "## Problem Statement",
        "",
        "Content.",
        "",
        "## Goals",
        "",
        "- Goal",
        "",
        "## Non-Goals",
        "",
        "- None",
        "",
        "## Features",
        "",
        "- **F1**: Feature",
        "",
        "## Success Criteria",
        "",
        "- Done",
      ].join("\n"),
    );
    // test-plan.md does not exist
    const result = await runReady();
    const requiredCheck = result.checks.find((c) => c.name === "Required specs present");
    expect(requiredCheck?.passed).toBe(false);
    expect(requiredCheck?.details).toContain("test-plan");
  });

  it("detects stale specs", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      [
        'version: "1.0"',
        "diff:",
        "  staleness_threshold_days: 7",
        "specs:",
        "  prd:",
        '    path: "specs/prd.md"',
        '    type: "prd"',
      ].join("\n"),
    );
    await writeFile(
      join(tempDir, "specs/prd.md"),
      [
        "---",
        'id: "prd-001"',
        'type: "prd"',
        'title: "Stale"',
        'status: "draft"',
        'version: "1.0"',
        'created: "2025-01-01"',
        'authors: ["dev"]',
        "---",
        "",
        "# Stale",
        "",
        "## Problem Statement",
        "",
        "Content.",
        "",
        "## Goals",
        "",
        "- Goal",
        "",
        "## Non-Goals",
        "",
        "- None",
        "",
        "## Features",
        "",
        "- **F1**: Feature",
        "",
        "## Success Criteria",
        "",
        "- Done",
      ].join("\n"),
    );
    const result = await runReady();
    const staleCheck = result.checks.find((c) => c.name === "No stale specs");
    expect(staleCheck?.passed).toBe(false);
    expect(staleCheck?.details).toContain("prd-001");
  });

  it("is NOT ready when the suite resolves to zero specs (vacuous-pass audit)", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      `version: "1.0"\nspecs:\n  prd:\n    path: "specs/*.md"\n    type: "prd"\n`,
    );

    const result = await runReady();
    expect(result.ready).toBe(false);
    const emptyCheck = result.checks.find((c) => c.name === "Spec suite non-empty");
    expect(emptyCheck?.passed).toBe(false);
  });

  it("does not tick lint health or staleness over an empty suite", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      `version: "1.0"\nspecs:\n  prd:\n    path: "specs/*.md"\n    type: "prd"\n`,
    );

    const result = await runReady();
    const lintCheck = result.checks.find((c) => c.name === "Lint health");
    const staleCheck = result.checks.find((c) => c.name === "No stale specs");
    expect(lintCheck?.skipped).toBe(true);
    expect(staleCheck?.skipped).toBe(true);
  });
});

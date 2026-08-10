import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runStatus } from "./status.js";

const CWD = process.cwd();

describe("runStatus", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "sdx-status-test-"));
    await mkdir(join(tempDir, "specs"), { recursive: true });
    process.chdir(tempDir);
  });
  afterEach(async () => {
    process.chdir(CWD);
    await rm(tempDir, { recursive: true });
  });

  it("reads a suite the caller points it at, not the process cwd (F8)", async () => {
    // A library consumer cannot chdir; runLint and runPack take a configDir,
    // so this must too. The assertion is that it works from *elsewhere*.
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      `version: "1.0"\nproject:\n  name: "elsewhere"\nspecs:\n  prd:\n    path: "specs/*.md"\n    type: "prd"\n`,
    );
    process.chdir(CWD);

    const result = await runStatus({ configDir: tempDir });
    expect(result.project).toBe("elsewhere");
  });

  it("names the count for what it counts, with no ambiguous specCount (F4)", async () => {
    // `specCount` meant resolved files here and config entries in runValidate.
    // MCP was cleaned up already; the CLI kept the ambiguity.
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      `version: "1.0"\nproject:\n  name: "named"\nspecs:\n  prd:\n    path: "specs/*.md"\n    type: "prd"\n`,
    );

    const result = await runStatus();
    expect(result.specFiles).toBe(0);
    expect((result as unknown as Record<string, unknown>).specCount).toBeUndefined();
  });

  it("reports unassessed, not healthy, for a suite with no specs (vacuous-pass audit)", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      `version: "1.0"\nproject:\n  name: "empty"\nspecs:\n  prd:\n    path: "specs/*.md"\n    type: "prd"\n`,
    );

    const result = await runStatus();
    expect(result.specFiles).toBe(0);
    expect(result.verdict).toBe("unassessed");
  });

  it("does not report unassessed when specs resolve", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      `version: "1.0"\nproject:\n  name: "ok"\nspecs:\n  prd:\n    path: "specs/prd.md"\n    type: "prd"\n`,
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

    const result = await runStatus();
    expect(result.specFiles).toBe(1);
    expect(result.verdict).not.toBe("unassessed");
  });
});

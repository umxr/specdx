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

  it("reports unassessed, not healthy, for a suite with no specs (vacuous-pass audit)", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      `version: "1.0"\nproject:\n  name: "empty"\nspecs:\n  prd:\n    path: "specs/*.md"\n    type: "prd"\n`,
    );

    const result = await runStatus();
    expect(result.specCount).toBe(0);
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
    expect(result.specCount).toBe(1);
    expect(result.verdict).not.toBe("unassessed");
  });
});

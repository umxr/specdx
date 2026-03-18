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
  afterEach(async () => { await rm(tempDir, { recursive: true }); });

  it("returns diagnostics for a spec with issues", async () => {
    await writeFile(join(tempDir, "spec.config.yaml"),
      `version: "1.0"\nspecs:\n  prd:\n    path: "specs/prd.md"\n    type: "prd"\n`);
    await writeFile(join(tempDir, "specs/prd.md"),
      `---\nid: "prd-001"\ntype: "prd"\ntitle: "Test"\nstatus: "draft"\nversion: "1.0"\ncreated: "2026-01-01"\nauthors: ["dev"]\n---\n\n# Test\n\n## Problem Statement\n\nSome content with TBD items.\n`);
    const result = await runLint({ configDir: tempDir });
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it("passes for a well-formed spec", async () => {
    await writeFile(join(tempDir, "spec.config.yaml"),
      `version: "1.0"\nspecs:\n  prd:\n    path: "specs/prd.md"\n    type: "prd"\n`);
    await writeFile(join(tempDir, "specs/prd.md"),
      ["---", 'id: "prd-001"', 'type: "prd"', 'title: "Test"', 'status: "draft"',
       'version: "1.0"', 'created: "2026-01-01"', 'authors: ["dev"]', "---", "",
       "# Test", "", "## Problem Statement", "", "Users need a solution.", "",
       "## Goals", "", "- Be useful", "", "## Non-Goals", "", "- Everything else", "",
       "## Features", "", "- **F1**: Core feature", "", "## Success Criteria", "", "- It works"].join("\n"));
    const result = await runLint({ configDir: tempDir });
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    expect(errors).toHaveLength(0);
  });
});

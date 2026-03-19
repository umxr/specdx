import { mkdtemp, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { diffBetweenRefs } from "./git.js";
import { DiffError } from "./types.js";

describe("diffBetweenRefs", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), "sdx-git-test-"));
    execSync("git init", { cwd: tmpDir });
    execSync("git config user.email 'test@test.com'", { cwd: tmpDir });
    execSync("git config user.name 'Test'", { cwd: tmpDir });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  // Helper to write spec.config.yaml + spec files and commit
  async function setupRepo() {
    // Write spec.config.yaml
    await writeFile(
      join(tmpDir, "spec.config.yaml"),
      `
version: "1.0"
project:
  name: "test"
specs:
  prd:
    path: specs/prd.md
    type: prd
  tech:
    path: specs/tech.md
    type: technical-design
    requires: ["prd"]
`,
    );
    await mkdir(join(tmpDir, "specs"));
    // Write initial specs
    await writeFile(
      join(tmpDir, "specs/prd.md"),
      `---
id: prd
type: prd
title: "Test PRD"
status: draft
version: "0.1"
created: "2026-01-01"
authors: ["test"]
---

## Problem Statement
Original problem.

## Goals
Original goals.
`,
    );
    await writeFile(
      join(tmpDir, "specs/tech.md"),
      `---
id: tech
type: technical-design
title: "Test Tech"
status: draft
version: "0.1"
created: "2026-01-01"
authors: ["test"]
---

## Overview
Original overview.
`,
    );
    execSync("git add -A && git commit -m 'initial'", { cwd: tmpDir });
    execSync("git tag base", { cwd: tmpDir });
  }

  it("detects modified spec between refs", async () => {
    await setupRepo();
    // Modify PRD
    await writeFile(
      join(tmpDir, "specs/prd.md"),
      `---
id: prd
type: prd
title: "Test PRD"
status: approved
version: "0.2"
created: "2026-01-01"
authors: ["test"]
---

## Problem Statement
Updated problem.

## Goals
Original goals.
`,
    );
    execSync("git add -A && git commit -m 'update prd'", { cwd: tmpDir });
    execSync("git tag head", { cwd: tmpDir });

    const result = await diffBetweenRefs(join(tmpDir, "spec.config.yaml"), "base", "head");
    expect(result.diffs.length).toBeGreaterThan(0);
    const prdDiff = result.diffs.find((d) => d.specId === "prd");
    expect(prdDiff).toBeDefined();
    expect(prdDiff!.frontmatter.length).toBeGreaterThan(0);
  });

  it("detects no changes between identical refs", async () => {
    await setupRepo();
    const result = await diffBetweenRefs(join(tmpDir, "spec.config.yaml"), "base", "base");
    expect(result.diffs).toHaveLength(0);
    expect(result.added).toHaveLength(0);
    expect(result.removed).toHaveLength(0);
  });

  it("throws DiffError for invalid ref", async () => {
    await setupRepo();
    await expect(
      diffBetweenRefs(join(tmpDir, "spec.config.yaml"), "nonexistent", "base"),
    ).rejects.toThrow(DiffError);
  });

  it("includes downstream impact analysis", async () => {
    await setupRepo();
    await writeFile(
      join(tmpDir, "specs/prd.md"),
      `---
id: prd
type: prd
title: "Test PRD"
status: approved
version: "0.2"
created: "2026-01-01"
authors: ["test"]
---

## Problem Statement
Updated problem.

## Goals
Updated goals.
`,
    );
    execSync("git add -A && git commit -m 'update prd'", { cwd: tmpDir });

    const result = await diffBetweenRefs(join(tmpDir, "spec.config.yaml"), "base", "HEAD");
    // tech depends on prd, so it should appear in impact
    expect(result.impact.length).toBeGreaterThan(0);
  });

  it("generates a summary string", async () => {
    await setupRepo();
    await writeFile(
      join(tmpDir, "specs/prd.md"),
      `---
id: prd
type: prd
title: "Test PRD"
status: approved
version: "0.2"
created: "2026-01-01"
authors: ["test"]
---

## Problem Statement
Changed.

## Goals
Changed.
`,
    );
    execSync("git add -A && git commit -m 'update'", { cwd: tmpDir });

    const result = await diffBetweenRefs(join(tmpDir, "spec.config.yaml"), "base", "HEAD");
    expect(result.summary.length).toBeGreaterThan(0);
  });
});

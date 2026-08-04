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

  // Every fixture above declares spec entries by literal path, so a glob entry
  // (`specs/stories/*.md`) was never exercised -- it matched no changed file and
  // diff reported a vacuous "no changes" for the majority of a real suite.
  async function setupGlobRepo() {
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
  stories:
    path: specs/stories/*.md
    type: user-story
    requires: ["prd"]
`,
    );
    await mkdir(join(tmpDir, "specs/stories"), { recursive: true });
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

## Goals
Original goals.
`,
    );
    await writeFile(
      join(tmpDir, "specs/stories/story-one.md"),
      `---
id: story-one
type: user-story
title: "Story One"
status: draft
version: "0.1"
created: "2026-01-01"
authors: ["test"]
---

## Acceptance Criteria
Original criteria.
`,
    );
    execSync("git add -A && git commit -m 'initial'", { cwd: tmpDir });
    execSync("git tag base", { cwd: tmpDir });
  }

  it("detects a modified spec inside a glob entry", async () => {
    await setupGlobRepo();
    await writeFile(
      join(tmpDir, "specs/stories/story-one.md"),
      `---
id: story-one
type: user-story
title: "Story One"
status: approved
version: "0.2"
created: "2026-01-01"
authors: ["test"]
---

## Acceptance Criteria
Updated criteria.
`,
    );
    execSync("git add -A && git commit -m 'update story'", { cwd: tmpDir });

    const result = await diffBetweenRefs(join(tmpDir, "spec.config.yaml"), "base", "HEAD");
    const storyDiff = result.diffs.find((d) => d.specId === "story-one");
    expect(storyDiff).toBeDefined();
    expect(storyDiff!.frontmatter.length).toBeGreaterThan(0);
  });

  it("detects a spec added inside a glob entry, keyed by its spec id", async () => {
    await setupGlobRepo();
    await writeFile(
      join(tmpDir, "specs/stories/story-two.md"),
      `---
id: story-two
type: user-story
title: "Story Two"
status: draft
version: "0.1"
created: "2026-01-01"
authors: ["test"]
---

## Acceptance Criteria
Brand new.
`,
    );
    execSync("git add -A && git commit -m 'add story'", { cwd: tmpDir });

    const result = await diffBetweenRefs(join(tmpDir, "spec.config.yaml"), "base", "HEAD");
    // The entry key is "stories"; the spec id is "story-two".
    expect(result.added).toContain("story-two");
  });

  it("detects a spec removed from a glob entry, keyed by its spec id", async () => {
    await setupGlobRepo();
    execSync("git rm -q specs/stories/story-one.md", { cwd: tmpDir });
    execSync("git commit -m 'remove story'", { cwd: tmpDir });

    const result = await diffBetweenRefs(join(tmpDir, "spec.config.yaml"), "base", "HEAD");
    expect(result.removed).toContain("story-one");
  });

  it("reports downstream impact on specs inside a glob entry", async () => {
    await setupGlobRepo();
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

## Goals
Updated goals.
`,
    );
    execSync("git add -A && git commit -m 'update prd'", { cwd: tmpDir });

    const result = await diffBetweenRefs(join(tmpDir, "spec.config.yaml"), "base", "HEAD");
    const prdImpact = result.impact.find((i) => i.changedSpec === "prd");
    expect(prdImpact).toBeDefined();
    expect(prdImpact!.downstream.map((d) => d.specId)).toContain("story-one");
  });

  // A ref-to-ref comparison cannot see the working tree, so an uncommitted spec
  // edit used to produce a bare "no changes" -- a false green at exactly the
  // moment specdx-pre-commit asks the question.
  describe("working tree", () => {
    async function editPrdWithoutCommitting() {
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
Uncommitted problem.

## Goals
Original goals.
`,
      );
    }

    it("reports uncommitted spec files the compared refs do not cover", async () => {
      await setupRepo();
      await editPrdWithoutCommitting();

      const result = await diffBetweenRefs(join(tmpDir, "spec.config.yaml"), "base", "HEAD");
      expect(result.diffs).toHaveLength(0);
      expect(result.uncommittedSpecFiles).toContain("specs/prd.md");
    });

    it("ignores uncommitted changes to files outside the spec suite", async () => {
      await setupRepo();
      await writeFile(join(tmpDir, "README.md"), "not a spec");

      const result = await diffBetweenRefs(join(tmpDir, "spec.config.yaml"), "base", "HEAD");
      expect(result.uncommittedSpecFiles).toHaveLength(0);
    });

    it("diffs a ref against the working tree when working is set", async () => {
      await setupRepo();
      await editPrdWithoutCommitting();

      const result = await diffBetweenRefs(join(tmpDir, "spec.config.yaml"), "base", "HEAD", {
        working: true,
      });
      const prdDiff = result.diffs.find((d) => d.specId === "prd");
      expect(prdDiff).toBeDefined();
      expect(prdDiff!.frontmatter.length).toBeGreaterThan(0);
      // The change is covered by the comparison, so it is not also a warning.
      expect(result.uncommittedSpecFiles).toHaveLength(0);
    });

    it("treats an untracked spec file as added in working mode", async () => {
      await setupGlobRepo();
      await writeFile(
        join(tmpDir, "specs/stories/story-new.md"),
        `---
id: story-new
type: user-story
title: "Story New"
status: draft
version: "0.1"
created: "2026-01-01"
authors: ["test"]
---

## Acceptance Criteria
Never committed.
`,
      );

      const result = await diffBetweenRefs(join(tmpDir, "spec.config.yaml"), "base", "HEAD", {
        working: true,
      });
      expect(result.added).toContain("story-new");
    });

    it("treats a spec deleted from the working tree as removed in working mode", async () => {
      await setupRepo();
      await rm(join(tmpDir, "specs/tech.md"));

      const result = await diffBetweenRefs(join(tmpDir, "spec.config.yaml"), "base", "HEAD", {
        working: true,
      });
      expect(result.removed).toContain("tech");
    });
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

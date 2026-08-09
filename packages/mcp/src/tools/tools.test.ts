import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { handleValidate } from "./validate.js";
import { handleLint } from "./lint.js";
import { handlePack } from "./pack.js";
import { handleStatus } from "./status.js";
import { handleCheck } from "./check.js";
import { handleDiff } from "./diff.js";
import { handleGraph } from "./graph.js";

const CONFIG = `version: "1.0"
project:
  name: "mcp-fixture"
specs:
  prd:
    path: specs/prd.md
    type: prd
    required: true
  stories:
    path: "specs/stories/*.md"
    type: user-story
    requires: ["prd"]
`;

const PRD = `---
id: "prd-001"
type: "prd"
title: "Fixture PRD"
status: "approved"
version: "1.0"
created: "2026-07-01"
updated: "2026-07-27"
authors: ["test"]
---

# Fixture PRD

## Problem Statement

Fixture problem.

## Goals

Fixture goals.

## Non-Goals

Fixture non-goals.

## Features

- **F1**: Fixture login feature

## Success Criteria

Fixture criteria.
`;

const STORY = `---
id: "story-001"
type: "user-story"
title: "Fixture login feature story"
status: "approved"
version: "1.0"
created: "2026-07-01"
updated: "2026-07-27"
authors: ["test"]
story_id: "US-1"
priority: "high"
estimate: "1"
---

# Story

## Description

Covers the fixture login feature.

## Acceptance Criteria

- Invalid input shows an error message

## Dependencies

F1 from prd-001

## Notes

None.
`;

let fixtureDir: string;
let originalCwd: string;

beforeAll(async () => {
  originalCwd = process.cwd();
  fixtureDir = await mkdtemp(join(tmpdir(), "sdx-mcp-test-"));
  await mkdir(join(fixtureDir, "specs", "stories"), { recursive: true });
  await writeFile(join(fixtureDir, "spec.config.yaml"), CONFIG);
  await writeFile(join(fixtureDir, "specs", "prd.md"), PRD);
  await writeFile(join(fixtureDir, "specs", "stories", "story-001.md"), STORY);
  const git = (...args: string[]) => execFileSync("git", args, { cwd: fixtureDir });
  git("init", "-b", "main");
  git("config", "user.email", "test@test.dev");
  git("config", "user.name", "test");
  git("add", ".");
  git("commit", "-m", "fixture");
  process.chdir(fixtureDir);
});

afterAll(async () => {
  process.chdir(originalCwd);
  await rm(fixtureDir, { recursive: true, force: true });
});

describe("sdx_validate", () => {
  it("reports a valid config with distinct entry and file counts", async () => {
    // `specCount` meant config entries here and resolved files in sdx_status,
    // so an agent reading both got two contradictory numbers for one project.
    const result = JSON.parse(await handleValidate({}));
    expect(result.valid).toBe(true);
    expect(result.specEntries).toBe(2);
    expect(result.specFiles).toBe(2);
    expect(result.specCount).toBeUndefined();
    expect(result.project).toBe("mcp-fixture");
  });

  it("reports an invalid config as an error payload, not a throw", async () => {
    const badDir = await mkdtemp(join(tmpdir(), "sdx-mcp-bad-"));
    await writeFile(
      join(badDir, "spec.config.yaml"),
      'version: "1.0"\nspecs:\n  bad:\n    type: nope\n',
    );
    const result = JSON.parse(await handleValidate({ configPath: badDir }));
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
    await rm(badDir, { recursive: true, force: true });
  });
});

describe("sdx_lint", () => {
  it("lints the suite and reports diagnostics structure", async () => {
    const result = JSON.parse(await handleLint({}));
    expect(result.specsChecked).toBe(2);
    expect(result.hasErrors).toBe(false);
    expect(Array.isArray(result.diagnostics)).toBe(true);
  });

  it("respects an explicit preset", async () => {
    const result = JSON.parse(await handleLint({ preset: "minimal" }));
    expect(result.specsChecked).toBe(2);
    expect(result.hasErrors).toBe(false);
  });
});

describe("sdx_pack", () => {
  it("packs the suite and returns non-empty output", async () => {
    const output = await handlePack({ task: "implement fixture login" });
    expect(output.length).toBeGreaterThan(0);
    expect(output).toContain("prd");
  });

  it("respects the json format option", async () => {
    const output = await handlePack({ format: "json", budget: 5000 });
    const parsed = JSON.parse(output) as Record<string, unknown>;
    expect(parsed).toBeTypeOf("object");
  });
});

describe("sdx_status", () => {
  it("reports suite health with verdict and counts", async () => {
    const result = JSON.parse(await handleStatus());
    expect(result.project).toBe("mcp-fixture");
    expect(result.specCount).toBe(2);
    expect(result.lintHealth.errors).toBe(0);
    expect(["healthy", "warnings", "errors"]).toContain(result.verdict);
  });
});

describe("sdx_check", () => {
  it("runs drift analysis and returns findings, score, and summary", async () => {
    const result = JSON.parse(await handleCheck({}));
    expect(Array.isArray(result.findings)).toBe(true);
    expect(result.score).toBeDefined();
    expect(typeof result.summary).toBe("string");
  });
});

describe("sdx_diff", () => {
  it("diffs identical refs to an empty change set", async () => {
    const result = JSON.parse(await handleDiff({ base: "HEAD", head: "HEAD" })) as {
      error?: string;
      diffs?: unknown[];
    };
    expect(result.error).toBeUndefined();
  });

  it("returns an error payload for an unknown ref, not a throw", async () => {
    const result = JSON.parse(await handleDiff({ base: "no-such-ref" }));
    expect(result.error).toBeTruthy();
  });
});

describe("sdx_graph", () => {
  it("returns nodes, edges, and downstream map", async () => {
    const result = JSON.parse(await handleGraph({}));
    expect(result.nodes).toContain("prd");
    expect(result.nodes).toContain("stories");
    expect(result.edges).toEqual([{ from: "prd", to: "stories" }]);
    expect(result.downstream.prd).toContain("stories");
  });

  it("supports dot format output", async () => {
    const output = await handleGraph({ format: "dot" });
    expect(output).toContain("digraph specs");
    expect(output).toContain('"prd" -> "stories"');
  });
});

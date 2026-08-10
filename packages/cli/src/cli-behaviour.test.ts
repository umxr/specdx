import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const cli = join(pkgRoot, "dist", "main.js");

/**
 * Flag contracts are only real at the process boundary.
 *
 * Every defect this file pins was invisible to a unit test: the command
 * accepted the flag, ignored it, and exited 0. These run the built CLI the way
 * a user and a CI step do, and assert on the exit code and the bytes.
 */
describe("CLI flag contracts", () => {
  let dir: string;

  const run = (...args: string[]) =>
    spawnSync(process.execPath, [cli, ...args], {
      cwd: dir,
      encoding: "utf-8",
      env: { ...process.env, ANTHROPIC_API_KEY: "" },
    });

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "sdx-cli-behaviour-"));
    mkdirSync(join(dir, "specs"), { recursive: true });
    writeFileSync(
      join(dir, "spec.config.yaml"),
      `version: "1.0"\nproject:\n  name: "flags"\nspecs:\n  prd:\n    path: "specs/prd.md"\n    type: "prd"\n`,
    );
    writeFileSync(
      join(dir, "specs", "prd.md"),
      [
        "---",
        "id: prd",
        "type: prd",
        'title: "Flags"',
        "status: draft",
        'version: "1.0.0"',
        'created: "2026-08-10"',
        "authors: [umar]",
        "---",
        "",
        "## Problem Statement",
        "",
        "Flags that do nothing.",
        "",
        "## Goals",
        "",
        "- Make every declared flag real.",
        "",
        "## Non-Goals",
        "",
        "- Nothing else.",
        "",
        "## Success Metrics",
        "",
        "- Every flag is honoured or rejected.",
        "",
        "## Features",
        "",
        "- **F1**: Reject an unknown format.",
        "",
      ].join("\n"),
    );
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it("rejects an unknown --format instead of printing prose and exiting 0", () => {
    // `lint --format bogus` used to render pretty output with exit 0.
    const result = run("lint", "--format", "bogus");
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain('unknown --format "bogus"');
  });

  it("rejects a real format that this command does not render", () => {
    // `ready --format github` fell through to pretty, so a CI step asking for
    // annotations got none and no signal that it had asked for nothing.
    const result = run("ready", "--format", "github");
    expect(result.status).toBe(1);
    expect(`${result.stdout}${result.stderr}`).toContain("This command renders: pretty, json");
  });

  it("gives validate a real --format json", () => {
    const result = run("validate", "--format", "json");
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    expect(parsed.valid).toBe(true);
    expect(parsed.specEntries).toBe(1);
    expect(parsed.specFiles).toBe(1);
    // The ambiguous name is gone from the CLI too, not only from MCP (F4).
    expect(parsed.specCount).toBeUndefined();
  });

  it("gives graph a real --format json", () => {
    const result = run("graph", "--format", "json");
    const parsed = JSON.parse(result.stdout) as { nodes: string[] };
    expect(parsed.nodes).toContain("prd");
  });

  it("keeps graph --format dot working, and now documents it", () => {
    expect(run("graph", "--format", "dot").stdout).toContain("digraph specs {");
    expect(run("graph", "--help").stdout).toContain("dot");
  });

  it("reports specFiles, not specCount, from status --format json", () => {
    const parsed = JSON.parse(run("status", "--format", "json").stdout) as Record<string, unknown>;
    expect(parsed.specFiles).toBe(1);
    expect(parsed.specCount).toBeUndefined();
  });

  it("emits annotations for check --format github", () => {
    // Previously fell through to pretty text with zero annotations.
    const result = run("check", "--format", "github");
    expect(result.stdout).toMatch(/^::(notice|warning|error)/m);
  });

  it("makes --quiet suppress the success line it advertises suppressing", () => {
    const loud = run("validate");
    const quiet = run("validate", "--quiet");
    expect(loud.stdout).toContain("Config valid");
    expect(quiet.stdout).not.toContain("Config valid");
    expect(quiet.status).toBe(0);
  });

  it("keeps problems visible under --quiet", () => {
    // Quiet suppresses chrome, never the reason a command is unhappy.
    const result = run("lint", "--quiet");
    expect(result.stdout + result.stderr).toContain("prd.md");
  });

  it("prints a formatted error, not a stack trace, for --ai with no key", () => {
    // The message was right and reached the user as an uncaught Error with the
    // full Node trace through citty (audit run 5, F7).
    const result = spawnSync(process.execPath, [cli, "check", "--ai"], {
      cwd: dir,
      encoding: "utf-8",
      env: { ...process.env, ANTHROPIC_API_KEY: undefined },
    });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("✗ ");
    expect(result.stderr).toContain("specdx-verify");
    expect(result.stderr).not.toMatch(/^\s+at /m);
  });
});

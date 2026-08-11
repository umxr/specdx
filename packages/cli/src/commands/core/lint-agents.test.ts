import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runLint, cleanRunMessage } from "./lint.js";

/**
 * Agent instruction files reaching `sdx lint`.
 *
 * The interesting cases are all about honesty rather than rule logic — the
 * rules themselves are tested in `@specdx/lint`. What matters here is that a
 * user can tell the difference between "your agent files are fine" and "your
 * agent files were never looked at", which is the distinction six audits of
 * this project kept finding collapsed.
 */
describe("runLint with agent instruction files", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "sdx-lint-agents-"));
    await mkdir(join(dir, "specs"), { recursive: true });
    await writeFile(
      join(dir, "specs", "prd.md"),
      [
        "---",
        'id: "prd"',
        'type: "prd"',
        'title: "T"',
        'status: "draft"',
        'version: "1.0"',
        'created: "2026-01-01"',
        'authors: ["dev"]',
        "---",
        "",
        "## Problem Statement",
        "",
        "Users need a thing.",
      ].join("\n"),
    );
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const config = (agents?: string) =>
    writeFile(
      join(dir, "spec.config.yaml"),
      `version: "1.0"\nspecs:\n  prd:\n    path: "specs/prd.md"\n    type: "prd"\n${agents ?? ""}`,
    );

  it("lints no agent files when the agents key is absent", async () => {
    await config();
    await writeFile(join(dir, "CLAUDE.md"), "no headings, and `gone/a.ts` too");

    // Opt-in: an existing suite must not acquire diagnostics on upgrade.
    const result = await runLint({ configDir: dir });
    expect(result.agentFiles).toBe(0);
    expect(result.diagnostics.filter((d) => d.ruleId.startsWith("agents/"))).toEqual([]);
  });

  it("lints agent files when the key is present", async () => {
    await config('agents:\n  paths: ["CLAUDE.md"]\n');
    await writeFile(join(dir, "CLAUDE.md"), "no headings here at all");

    const result = await runLint({ configDir: dir });
    expect(result.agentFiles).toBe(1);
    expect(result.diagnostics.map((d) => d.ruleId)).toContain("agents/structure");
  });

  it("errors when agents.paths matches nothing, rather than passing quietly", async () => {
    await config('agents:\n  paths: ["AGENTS.md"]\n');

    const result = await runLint({ configDir: dir });
    expect(result.agentFiles).toBe(0);
    expect(result.hasErrors).toBe(true);
    const diagnostic = result.diagnostics.find((d) => d.ruleId === "agents/paths-match-nothing");
    expect(diagnostic).toBeDefined();
    // The message has to name the patterns, or the user cannot tell which of
    // several globs missed.
    expect(diagnostic!.message).toContain("AGENTS.md");
    expect(diagnostic!.filePath).toBe("spec.config.yaml");
  });

  it("keeps the spec suite assessed even when agent paths miss", async () => {
    // The specs *were* linted, so this is an error diagnostic, not exit 3.
    await config('agents:\n  paths: ["AGENTS.md"]\n');
    const result = await runLint({ configDir: dir });
    expect(result.assessed).toBe(true);
    expect(result.specFiles).toBe(1);
  });

  it("narrows agent diagnostics with a path filter, like spec diagnostics", async () => {
    await config('agents:\n  paths: ["*.md"]\n');
    await writeFile(join(dir, "CLAUDE.md"), "no headings");
    await writeFile(join(dir, "AGENTS.md"), "no headings");

    const all = await runLint({ configDir: dir });
    expect(all.diagnostics.filter((d) => d.ruleId === "agents/structure")).toHaveLength(2);

    const one = await runLint({ configDir: dir, specPath: "CLAUDE.md" });
    expect(one.diagnostics.filter((d) => d.ruleId === "agents/structure")).toHaveLength(1);
  });

  it("does not let agent files enter the spec count", async () => {
    // Constraint 1 of the ADR: these are never specs. If they leaked into
    // `specFiles` they would also be leaking into the graph and into pack.
    await config('agents:\n  paths: ["CLAUDE.md"]\n');
    await writeFile(join(dir, "CLAUDE.md"), "# A");

    const result = await runLint({ configDir: dir });
    expect(result.specFiles).toBe(1);
    expect(result.agentFiles).toBe(1);
  });

  it("throws a usable message for an unknown rule id in agents.rules", async () => {
    await config('agents:\n  paths: ["CLAUDE.md"]\n  rules:\n    agents/typo: "error"\n');
    await writeFile(join(dir, "CLAUDE.md"), "# A");

    await expect(runLint({ configDir: dir })).rejects.toThrow(/Unknown agent rule/);
  });
});

describe("runLint with no spec suite (the zero-config on-ramp)", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "sdx-lint-noconfig-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("lints CLAUDE.md with no spec.config.yaml at all", async () => {
    await writeFile(join(dir, "CLAUDE.md"), "no headings, and `gone/a.ts` is gone");

    const result = await runLint({ configDir: dir });
    expect(result.specSuite).toBe(false);
    expect(result.agentFiles).toBe(1);
    expect(result.specFiles).toBe(0);
    expect(result.diagnostics.map((d) => d.ruleId)).toContain("agents/structure");
  });

  it("finds AGENTS.md too", async () => {
    await writeFile(join(dir, "AGENTS.md"), "no headings here");
    const result = await runLint({ configDir: dir });
    expect(result.agentFiles).toBe(1);
  });

  it("still errors when there is neither a config nor an agent file", async () => {
    // The on-ramp must not turn "you are in the wrong directory" into a pass.
    await expect(runLint({ configDir: dir })).rejects.toThrow(/No spec\.config\.yaml found/);
  });

  it("does NOT degrade to agent-only mode when the config exists but is broken", async () => {
    // The important one. A malformed config and a missing one both surface as
    // ConfigError; degrading on the second would turn a YAML typo into a
    // narrower check reported as a pass — the vacuous-pass shape one level up.
    await writeFile(join(dir, "CLAUDE.md"), "# Fine\n\nNothing wrong here.");
    await writeFile(join(dir, "spec.config.yaml"), "version: [unclosed\n");

    await expect(runLint({ configDir: dir })).rejects.toThrow();
    const error = await runLint({ configDir: dir }).catch((e: Error) => e);
    expect((error as Error).message).not.toMatch(/Run 'specdx init'/);
  });

  it("does NOT degrade when the config is present but schema-invalid", async () => {
    await writeFile(join(dir, "CLAUDE.md"), "# Fine\n\nNothing wrong here.");
    await writeFile(join(dir, "spec.config.yaml"), 'version: "1.0"\nnotAKey: true\n');

    await expect(runLint({ configDir: dir })).rejects.toThrow(/Invalid config/);
  });

  it("reports assessed false, because there is no spec suite to assess", async () => {
    await writeFile(join(dir, "CLAUDE.md"), "# Fine\n\nNothing wrong here.");
    const result = await runLint({ configDir: dir });
    // `assessed` keeps its meaning; `specSuite` is what tells a caller this
    // zero is expected rather than a suite that resolved to nothing.
    expect(result.assessed).toBe(false);
    expect(result.specSuite).toBe(false);
  });
});

describe("cleanRunMessage", () => {
  // This string is the entire output of a passing run, so it is the only place
  // a user can see what was actually checked.
  const suite = (specFiles: number, agentFiles: number) =>
    cleanRunMessage({ specFiles, agentFiles, specSuite: true });

  it("names only specs when no agent files were linted", () => {
    expect(suite(18, 0)).toContain("18 specs checked");
  });

  it("names agent files when they were linted", () => {
    expect(suite(18, 1)).toContain("18 specs and 1 agent file checked");
  });

  it("distinguishes a run that checked agent files from one that did not", () => {
    // The two must not render identically — that is the whole point.
    expect(suite(3, 0)).not.toBe(suite(3, 2));
  });

  it("pluralises both counts", () => {
    expect(suite(1, 2)).toContain("1 spec and 2 agent files");
  });

  it("never claims specs were checked in agent-only mode", () => {
    // "0 specs checked" would be technically true and actively misleading —
    // it reads as a suite that resolved to nothing, which is a defect, rather
    // than a project that simply has no suite.
    const message = cleanRunMessage({ specFiles: 0, agentFiles: 1, specSuite: false });
    expect(message).toContain("1 agent file checked");
    expect(message).not.toContain("0 specs");
    expect(message).toContain("No spec.config.yaml");
  });

  it("tells an agent-only run how to add a spec suite", () => {
    // Someone in the wrong directory has to be able to tell this apart from a
    // healthy run of a real project.
    expect(cleanRunMessage({ specFiles: 0, agentFiles: 2, specSuite: false })).toContain(
      "specdx init",
    );
  });
});

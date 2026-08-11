import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { SdxConfig } from "@specdx/schema";
import { structureRule } from "./rules/structure.js";
import { sizeBudgetRule } from "./rules/size-budget.js";
import { lintAgentFiles, resolveAgentRules, AgentConfigError, AGENT_RULES } from "./index.js";
import type { AgentFile, AgentLintContext } from "./types.js";

const file = (content: string, tokens = 10): AgentFile => ({
  filePath: "/repo/CLAUDE.md",
  relativePath: "CLAUDE.md",
  content,
  lines: content.split("\n"),
  tokens,
});

const context = (f: AgentFile, maxTokens = 8000): AgentLintContext => ({
  file: f,
  configDir: "/repo",
  exists: () => true,
  maxTokens,
});

describe("agents/structure", () => {
  it("flags an empty file", () => {
    const result = structureRule.run(context(file("   \n\n  ")));
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]!.message).toContain("is empty");
  });

  it("flags a file with no headings", () => {
    const result = structureRule.run(context(file("Always run the tests.\nBe careful.")));
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]!.message).toContain("no headings");
  });

  it("accepts a file organised under headings", () => {
    const result = structureRule.run(
      context(file("# Project\n\nContext.\n\n## Rules\n\nBe kind.")),
    );
    expect(result.diagnostics).toEqual([]);
  });

  it("does not also complain about headings when the file is empty", () => {
    // An empty file trivially has no headings; reporting both is two
    // diagnostics for one problem.
    const result = structureRule.run(context(file("")));
    expect(result.diagnostics).toHaveLength(1);
  });

  it("does not count a bare # or a hashtag as a heading", () => {
    expect(structureRule.run(context(file("#\n#nottag text"))).diagnostics).toHaveLength(1);
  });
});

describe("agents/size-budget", () => {
  it("stays silent within budget", () => {
    expect(sizeBudgetRule.run(context(file("x", 100), 8000)).diagnostics).toEqual([]);
  });

  it("stays silent exactly at the budget", () => {
    expect(sizeBudgetRule.run(context(file("x", 8000), 8000)).diagnostics).toEqual([]);
  });

  it("flags one token over, and reports the real numbers", () => {
    const result = sizeBudgetRule.run(context(file("x", 8001), 8000));
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]!.message).toContain("8001 tokens");
    expect(result.diagnostics[0]!.message).toContain("1 over the 8000 budget");
  });
});

describe("resolveAgentRules", () => {
  it("returns every rule when nothing is overridden", () => {
    expect(resolveAgentRules().map((r) => r.id)).toEqual(AGENT_RULES.map((r) => r.id));
  });

  it("removes a rule set to off, and to false", () => {
    expect(resolveAgentRules({ "agents/size-budget": "off" }).map((r) => r.id)).not.toContain(
      "agents/size-budget",
    );
    expect(resolveAgentRules({ "agents/size-budget": false }).map((r) => r.id)).not.toContain(
      "agents/size-budget",
    );
  });

  it("overrides a severity", () => {
    const rules = resolveAgentRules({ "agents/stale-references": "error" });
    expect(rules.find((r) => r.id === "agents/stale-references")!.severity).toBe("error");
  });

  it("does not mutate the shared rule objects when overriding", () => {
    resolveAgentRules({ "agents/stale-references": "error" });
    // A second caller with no overrides must still get the default severity.
    expect(resolveAgentRules().find((r) => r.id === "agents/stale-references")!.severity).toBe(
      "warn",
    );
  });

  it("throws on an unknown rule id rather than silently configuring nothing", () => {
    // `lint.rules` shipped inert for six audits partly because a typo looked
    // configured. An unknown id has to be loud.
    expect(() => resolveAgentRules({ "agents/typo": "error" })).toThrow(AgentConfigError);
  });

  it("throws on an unknown rule id even when switching it off", () => {
    expect(() => resolveAgentRules({ "agents/typo": "off" })).toThrow(AgentConfigError);
  });

  it("throws on a severity that is not a severity", () => {
    expect(() => resolveAgentRules({ "agents/size-budget": "loud" })).toThrow(AgentConfigError);
  });
});

describe("lintAgentFiles", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "sdx-agents-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const config = (agents: SdxConfig["agents"]): SdxConfig => ({
    version: "1.0",
    specs: {},
    agents,
  });

  it("reports assessed: false when the configured paths match nothing", async () => {
    // The vacuous-pass shape: no diagnostics because nothing was inspected.
    const result = await lintAgentFiles({ config: config({}), configDir: dir });
    expect(result.filesLinted).toBe(0);
    expect(result.assessed).toBe(false);
    expect(result.diagnostics).toEqual([]);
  });

  it("lints AGENTS.md and CLAUDE.md by default", async () => {
    await writeFile(join(dir, "AGENTS.md"), "# A\n\nSee `nope/a.ts`.");
    await writeFile(join(dir, "CLAUDE.md"), "# C\n\nSee `nope/c.ts`.");
    const result = await lintAgentFiles({ config: config({}), configDir: dir });
    expect(result.filesLinted).toBe(2);
    expect(result.assessed).toBe(true);
    expect(result.diagnostics.filter((d) => d.ruleId === "agents/stale-references")).toHaveLength(
      2,
    );
  });

  it("honours explicit paths over the defaults", async () => {
    await mkdir(join(dir, "nested"), { recursive: true });
    await writeFile(join(dir, "AGENTS.md"), "# A");
    await writeFile(join(dir, "nested", "CLAUDE.md"), "# N");
    const result = await lintAgentFiles({
      config: config({ paths: ["nested/CLAUDE.md"] }),
      configDir: dir,
    });
    expect(result.filesLinted).toBe(1);
  });

  it("lints a file matched by two patterns only once", async () => {
    await writeFile(join(dir, "AGENTS.md"), "no headings here");
    const result = await lintAgentFiles({
      config: config({ paths: ["AGENTS.md", "*.md"] }),
      configDir: dir,
    });
    expect(result.filesLinted).toBe(1);
    expect(result.diagnostics.filter((d) => d.ruleId === "agents/structure")).toHaveLength(1);
  });

  it("stamps the rule's severity over whatever the diagnostic carried", async () => {
    await writeFile(join(dir, "AGENTS.md"), "# A\n\nSee `nope/a.ts`.");
    const result = await lintAgentFiles({
      config: config({ rules: { "agents/stale-references": "error" } }),
      configDir: dir,
    });
    const stale = result.diagnostics.filter((d) => d.ruleId === "agents/stale-references");
    expect(stale).toHaveLength(1);
    expect(stale[0]!.severity).toBe("error");
  });

  it("turns a rule's assessed:false into an info notice, not a silent pass", async () => {
    await writeFile(join(dir, "AGENTS.md"), "# A\n\nJust be careful.");
    const result = await lintAgentFiles({ config: config({}), configDir: dir });
    const notice = result.diagnostics.find((d) => d.ruleId === "agents/stale-references");
    expect(notice).toBeDefined();
    expect(notice!.severity).toBe("info");
    expect(notice!.message).toContain("names no file paths");
  });

  it("keeps the not-assessed notice at info even when the rule is set to error", async () => {
    // Otherwise promoting the rule's severity would turn "there was nothing to
    // check" into a build failure, which is a different claim entirely.
    await writeFile(join(dir, "AGENTS.md"), "# A\n\nJust be careful.");
    const result = await lintAgentFiles({
      config: config({ rules: { "agents/stale-references": "error" } }),
      configDir: dir,
    });
    const notice = result.diagnostics.find((d) => d.ruleId === "agents/stale-references");
    expect(notice!.severity).toBe("info");
  });

  it("resolves references against the config directory, not the file's own directory", async () => {
    await mkdir(join(dir, "docs"), { recursive: true });
    await writeFile(join(dir, "docs", "ci.md"), "# CI");
    await writeFile(join(dir, "AGENTS.md"), "# A\n\nSee `docs/ci.md`.");
    const result = await lintAgentFiles({ config: config({}), configDir: dir });
    expect(result.diagnostics.filter((d) => d.severity !== "info")).toEqual([]);
  });

  it("applies max_tokens from config", async () => {
    await writeFile(join(dir, "AGENTS.md"), `# A\n\n${"word ".repeat(200)}`);
    const result = await lintAgentFiles({
      config: config({ max_tokens: 10 }),
      configDir: dir,
    });
    expect(result.diagnostics.filter((d) => d.ruleId === "agents/size-budget")).toHaveLength(1);
  });
});

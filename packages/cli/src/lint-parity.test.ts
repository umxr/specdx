import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleLint } from "@specdx/mcp";
import { runLint } from "./commands/core/lint.js";

const CWD = process.cwd();

/**
 * `sdx_lint` is a near-copy of `runLint`, not a caller of it, for the same
 * reason `sdx_status` is: the CLI depends on the MCP package, so the
 * dependency cannot run the other way.
 *
 * The pair had already drifted by the time this was written. Both surfaces
 * treated a `specPath` matching nothing as a clean pass, and MCP additionally
 * filtered the spec list *before* linting — so a single-file lint over MCP
 * could not see the rest of the suite and cross-reference rules were unable to
 * fire at all. Neither divergence was reachable from a unit test on one side.
 *
 * The fixtures below are built to expose exactly those two shapes.
 */
describe("sdx_lint agrees with runLint", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "sdx-lint-parity-"));
    await mkdir(join(tempDir, "specs"), { recursive: true });
    process.chdir(tempDir);
  });
  afterEach(async () => {
    process.chdir(CWD);
    await rm(tempDir, { recursive: true, force: true });
  });

  const spec = (id: string, extra = "") =>
    [
      "---",
      `id: "${id}"`,
      'type: "prd"',
      'title: "Test"',
      'status: "draft"',
      'version: "1.0"',
      'created: "2026-01-01"',
      'authors: ["dev"]',
      extra,
      "---",
      "",
      "# Test",
      "",
      "## Problem Statement",
      "",
      "Users need a solution.",
    ]
      .filter(Boolean)
      .join("\n");

  const write = async (name: string, body: string) => writeFile(join(tempDir, "specs", name), body);

  const config = `version: "1.0"\nproject:\n  name: "parity"\nspecs:\n  all:\n    path: "specs/*.md"\n    type: "prd"\n`;

  const mcp = async (params: { specPath?: string }) =>
    JSON.parse(await handleLint(params)) as {
      diagnostics: { ruleId: string; filePath: string; severity: string }[];
      hasErrors: boolean;
      hasWarnings: boolean;
      specsChecked: number;
      assessed: boolean;
      agentFilesChecked: number;
    };

  it("agrees that a specPath matching no spec assessed nothing", async () => {
    await writeFile(join(tempDir, "spec.config.yaml"), config);
    await write("one.md", spec("prd-one"));

    const cli = await runLint({ configDir: tempDir, specPath: "specs/typo.md" });
    const tool = await mcp({ specPath: "specs/typo.md" });

    expect(cli.assessed).toBe(false);
    expect(tool.assessed).toBe(false);
    expect(cli.specFiles).toBe(tool.specsChecked);
    // The trap: both report no diagnostics, so `hasErrors` alone reads as a
    // pass on either surface. `assessed` is the only thing separating them.
    expect(cli.diagnostics).toHaveLength(0);
    expect(tool.diagnostics).toHaveLength(0);
  });

  it("agrees on the count of specs a specPath selected", async () => {
    await writeFile(join(tempDir, "spec.config.yaml"), config);
    for (const name of ["one", "two", "three"]) {
      await write(`${name}.md`, spec(`prd-${name}`));
    }

    const cliAll = await runLint({ configDir: tempDir });
    const toolAll = await mcp({});
    expect(cliAll.specFiles).toBe(3);
    expect(toolAll.specsChecked).toBe(3);

    const cliOne = await runLint({ configDir: tempDir, specPath: "specs/two.md" });
    const toolOne = await mcp({ specPath: "specs/two.md" });
    expect(cliOne.specFiles).toBe(1);
    expect(toolOne.specsChecked).toBe(1);
    expect(cliOne.assessed).toBe(true);
    expect(toolOne.assessed).toBe(true);
  });

  it("agrees on diagnostics for a single-file lint, cross-references included", async () => {
    await writeFile(join(tempDir, "spec.config.yaml"), config);
    // `one` references `two`, which is **valid**. That is what makes this
    // fixture able to tell the two implementations apart: a surface that
    // filters the suite down to `one.md` before linting can no longer see that
    // `prd-two` exists, so it invents a broken-reference error the CLI does
    // not report. A reference to a *nonexistent* id would error either way and
    // would prove nothing — the first version of this test made that mistake
    // and passed against a deliberately reintroduced bug.
    await write(
      "one.md",
      spec("prd-one", 'references:\n  - id: "prd-two"\n    relationship: "depends-on"'),
    );
    await write("two.md", spec("prd-two"));

    const cli = await runLint({ configDir: tempDir, specPath: "specs/one.md" });
    const tool = await mcp({ specPath: "specs/one.md" });

    expect(cli.diagnostics.map((d) => d.ruleId).sort()).toEqual(
      tool.diagnostics.map((d) => d.ruleId).sort(),
    );
    expect(cli.hasErrors).toBe(tool.hasErrors);
    expect(cli.hasWarnings).toBe(tool.hasWarnings);
    // Neither surface may invent a broken reference to a spec that exists.
    expect(cli.diagnostics.filter((d) => d.ruleId === "structure/valid-references")).toHaveLength(
      0,
    );
    expect(tool.diagnostics.filter((d) => d.ruleId === "structure/valid-references")).toHaveLength(
      0,
    );
    // Every diagnostic that survived belongs to the selected file.
    for (const d of tool.diagnostics) expect(d.filePath).toContain("one.md");
  });

  describe("agent instruction files", () => {
    // Agent linting landed on both surfaces in one commit precisely so they
    // would not drift. These cases exist so that stays true — the pair has
    // already diverged twice on this file, and a rebase reintroduced a
    // hand-rolled copy of the path predicate on the CLI side once more.
    const agentConfig = `${config}agents:\n  paths: ["CLAUDE.md"]\n`;

    it("agrees on findings in an agent file", async () => {
      await writeFile(join(tempDir, "spec.config.yaml"), agentConfig);
      await write("one.md", spec("prd-one"));
      await writeFile(join(tempDir, "CLAUDE.md"), "no headings, and `gone/a.ts` is gone");

      const cli = await runLint({ configDir: tempDir });
      const tool = await mcp({});

      expect(cli.agentFiles).toBe(1);
      expect(tool.agentFilesChecked).toBe(1);
      expect(cli.diagnostics.map((d) => d.ruleId).sort()).toEqual(
        tool.diagnostics.map((d) => d.ruleId).sort(),
      );
      expect(cli.diagnostics.map((d) => d.ruleId)).toContain("agents/structure");
    });

    it("agrees that agent paths matching nothing is an error, not a pass", async () => {
      await writeFile(join(tempDir, "spec.config.yaml"), agentConfig);
      await write("one.md", spec("prd-one"));
      // No CLAUDE.md written.

      const cli = await runLint({ configDir: tempDir });
      const tool = await mcp({});

      expect(cli.hasErrors).toBe(true);
      expect(tool.hasErrors).toBe(true);
      expect(cli.diagnostics.map((d) => d.ruleId)).toContain("agents/paths-match-nothing");
      expect(tool.diagnostics.map((d) => d.ruleId)).toContain("agents/paths-match-nothing");
      // The specs were still assessed, so this is an error, not "nothing ran".
      expect(cli.assessed).toBe(true);
      expect(tool.assessed).toBe(true);
    });

    it("agrees on narrowing agent diagnostics by path", async () => {
      // The CLI filtered agent diagnostics through a hand-rolled predicate
      // after a rebase, while MCP used the shared one. Identical behaviour
      // here, so a second copy on either side shows up as disagreement.
      await writeFile(join(tempDir, "spec.config.yaml"), `${config}agents:\n  paths: ["*.md"]\n`);
      await write("one.md", spec("prd-one"));
      await writeFile(join(tempDir, "CLAUDE.md"), "no headings");
      await writeFile(join(tempDir, "AGENTS.md"), "no headings");

      const cliAll = await runLint({ configDir: tempDir });
      const toolAll = await mcp({});
      expect(cliAll.diagnostics.filter((d) => d.ruleId === "agents/structure")).toHaveLength(2);
      expect(toolAll.diagnostics.filter((d) => d.ruleId === "agents/structure")).toHaveLength(2);

      const cliOne = await runLint({ configDir: tempDir, specPath: "CLAUDE.md" });
      const toolOne = await mcp({ specPath: "CLAUDE.md" });
      expect(cliOne.diagnostics.filter((d) => d.ruleId === "agents/structure")).toHaveLength(1);
      expect(toolOne.diagnostics.filter((d) => d.ruleId === "agents/structure")).toHaveLength(1);
    });

    it("agrees that no agents key means no agent linting", async () => {
      await writeFile(join(tempDir, "spec.config.yaml"), config);
      await write("one.md", spec("prd-one"));
      await writeFile(join(tempDir, "CLAUDE.md"), "no headings at all");

      const cli = await runLint({ configDir: tempDir });
      const tool = await mcp({});

      expect(cli.agentFiles).toBe(0);
      expect(tool.agentFilesChecked).toBe(0);
      expect(cli.diagnostics.filter((d) => d.ruleId.startsWith("agents/"))).toEqual([]);
      expect(tool.diagnostics.filter((d) => d.ruleId.startsWith("agents/"))).toEqual([]);
    });
  });

  it("agrees on a whole-suite lint", async () => {
    await writeFile(join(tempDir, "spec.config.yaml"), config);
    await write("one.md", spec("prd-one"));
    await write("two.md", spec("prd-two"));

    const cli = await runLint({ configDir: tempDir });
    const tool = await mcp({});

    expect(cli.diagnostics.map((d) => d.ruleId).sort()).toEqual(
      tool.diagnostics.map((d) => d.ruleId).sort(),
    );
    expect(cli.hasErrors).toBe(tool.hasErrors);
    expect(cli.specFiles).toBe(tool.specsChecked);
    expect(cli.assessed).toBe(tool.assessed);
  });
});

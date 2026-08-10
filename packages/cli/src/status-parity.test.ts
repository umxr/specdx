import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { handleStatus } from "@specdx/mcp";
import { runStatus } from "./commands/core/status.js";

const CWD = process.cwd();

/**
 * `sdx_status` is a near-copy of `runStatus`, not a caller of it.
 *
 * The two cannot be unified without moving `runStatus` below the CLI, since
 * the CLI depends on the MCP package and not the other way round. So the
 * duplication stands — but silently. Audit run 6 fixed `lintHealth.passing`
 * in `runStatus`, shipped it, and only found the MCP copy still returning
 * `-6` by re-running the harness against the published tarball. A unit test
 * on either side alone would have passed.
 *
 * This pins the two to each other on a fixture built to expose exactly the
 * kind of divergence that got through: more errors than specs.
 */
describe("sdx_status agrees with runStatus", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "sdx-status-parity-"));
    await mkdir(join(tempDir, "specs"), { recursive: true });
    process.chdir(tempDir);
  });
  afterEach(async () => {
    process.chdir(CWD);
    await rm(tempDir, { recursive: true, force: true });
  });

  const config = (name: string) =>
    `version: "1.0"\nproject:\n  name: "${name}"\nspecs:\n  prd:\n    path: "specs/prd.md"\n    type: "prd"\n`;

  /** A spec with several error-severity diagnostics — errors outnumber specs. */
  const brokenSpec = [
    "---",
    'id: "prd"',
    'type: "prd"',
    'title: "Broken"',
    "status: not-a-real-status",
    'version: "1.0"',
    'created: "not-a-date"',
    "authors: []",
    "---",
    "",
    "## Problem Statement",
    "",
    "Deliberately invalid frontmatter and missing sections.",
  ].join("\n");

  const healthySpec = [
    "---",
    'id: "prd"',
    'type: "prd"',
    'title: "Healthy"',
    'status: "draft"',
    'version: "1.0"',
    `created: "${new Date().toISOString().slice(0, 10)}"`,
    'authors: ["dev"]',
    "---",
    "",
    "## Problem Statement",
    "",
    "A suite with nothing wrong with it.",
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
  ].join("\n");

  it.each([
    ["a suite with more errors than specs", brokenSpec],
    ["a healthy suite", healthySpec],
  ])("reports the same health for %s", async (_label, spec) => {
    await writeFile(join(tempDir, "spec.config.yaml"), config("parity"));
    await writeFile(join(tempDir, "specs/prd.md"), spec);

    const cli = await runStatus();
    const mcp = JSON.parse(await handleStatus()) as typeof cli;

    expect(mcp.specFiles).toBe(cli.specFiles);
    expect(mcp.verdict).toBe(cli.verdict);
    expect(mcp.lintHealth).toEqual(cli.lintHealth);
    // The value the divergence was found in, asserted absolutely as well as
    // relatively — two implementations agreeing on a wrong number is not parity.
    expect(mcp.lintHealth.passing).toBeGreaterThanOrEqual(0);
    expect(mcp.lintHealth.passing).toBeLessThanOrEqual(mcp.specFiles);
  });

  it("reports the same health for a suite that resolves to no files", async () => {
    await writeFile(join(tempDir, "spec.config.yaml"), config("empty"));

    const cli = await runStatus();
    const mcp = JSON.parse(await handleStatus()) as typeof cli;

    expect(mcp.verdict).toBe("unassessed");
    expect(mcp.verdict).toBe(cli.verdict);
    expect(mcp.lintHealth).toEqual(cli.lintHealth);
  });
});

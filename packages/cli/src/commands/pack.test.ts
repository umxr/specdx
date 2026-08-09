import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runPack, emptyPackReason } from "./pack.js";

const specContent = [
  "---",
  'id: "td-001"',
  'type: "technical-design"',
  'title: "Auth Design"',
  'status: "draft"',
  'version: "1.0"',
  'created: "2026-01-01"',
  'authors: ["dev"]',
  "---",
  "",
  "# Auth Design",
  "",
  "## Context",
  "",
  "We need authentication for the API.",
  "",
  "## Decision",
  "",
  "Use JWT tokens for stateless auth.",
].join("\n");

describe("runPack", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "sdx-pack-test-"));
    await mkdir(join(tempDir, "specs"), { recursive: true });
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      `version: "1.0"\nspecs:\n  td:\n    path: "specs/td-001.md"\n    type: "technical-design"\n`,
    );
    await writeFile(join(tempDir, "specs/td-001.md"), specContent);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it("returns XML pack result by default", async () => {
    const result = await runPack({ configDir: tempDir });

    expect(result.output).toContain("<context");
    expect(result.output).toContain("</context>");
    expect(result.output).toContain("td-001");
    expect(result.stats.specsIncluded).toBe(1);
  });

  it("returns JSON format when requested", async () => {
    const result = await runPack({ configDir: tempDir, format: "json" });

    const parsed = JSON.parse(result.output) as { specs: { id: string }[] };
    expect(parsed.specs.length).toBe(1);
    expect(parsed.specs[0]!.id).toBe("td-001");
  });

  it("returns dry-run stats without output", async () => {
    const result = await runPack({ configDir: tempDir, dryRun: true });

    expect(result.output).toBe("");
    expect(result.stats.specsIncluded).toBe(1);
    expect(result.stats.budget).toBeGreaterThan(0);
  });

  it("filters by task relevance", async () => {
    const result = await runPack({ configDir: tempDir, task: "authentication" });

    expect(result.stats.specsIncluded).toBeGreaterThanOrEqual(1);
    expect(result.output).toContain("td-001");
  });

  it("returns markdown format when requested", async () => {
    const result = await runPack({ configDir: tempDir, format: "markdown" });

    expect(result.output).toContain("# td-001");
    expect(result.output).not.toContain("<context");
  });
});

describe("emptyPackReason", () => {
  it("returns undefined when specs were packed", () => {
    expect(emptyPackReason({ specsIncluded: 3, specsExcluded: 1 }, 4)).toBeUndefined();
  });

  it("names an unresolved config when nothing resolved at all", () => {
    const reason = emptyPackReason({ specsIncluded: 0, specsExcluded: 0 }, 0);
    expect(reason).toMatch(/no specs resolved/);
  });

  it("names the relevance threshold when specs resolved but none scored", () => {
    const reason = emptyPackReason({ specsIncluded: 0, specsExcluded: 0 }, 7);
    expect(reason).toMatch(/none of the 7 resolved spec\(s\)/);
  });

  it("names exclusion when candidates existed but none were selected", () => {
    const reason = emptyPackReason({ specsIncluded: 0, specsExcluded: 5 }, 5);
    expect(reason).toMatch(/all 5 candidate spec\(s\) were excluded/);
  });
});

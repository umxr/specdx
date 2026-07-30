import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { parseArtifacts, checkArtifacts } from "./artifacts.js";
import type { ParsedSpec } from "@specdx/core";

const fixtureDir = join(import.meta.dirname, "../test/fixtures-artifacts");

function makeSpec(id: string, artifacts: unknown): ParsedSpec {
  return {
    filePath: `/specs/${id}.md`,
    frontmatter: {
      id,
      type: "technical-design",
      title: `Spec ${id}`,
      status: "draft",
      version: "1.0",
      created: "2026-07-30",
      authors: ["test"],
      artifacts,
    },
    content: "",
    sections: [],
    parsedSections: [],
    valid: true,
    validationErrors: null,
  };
}

describe("parseArtifacts", () => {
  it("parses well-formed artifact declarations", () => {
    const spec = makeSpec("d1", [
      { path: "middleware.ts" },
      { path: "src/lib/bots.ts", exports: ["BOT_SIGNATURES"] },
    ]);
    expect(parseArtifacts(spec)).toEqual([
      { path: "middleware.ts", exports: undefined },
      { path: "src/lib/bots.ts", exports: ["BOT_SIGNATURES"] },
    ]);
  });

  it("returns empty for missing or malformed declarations", () => {
    expect(parseArtifacts(makeSpec("d1", undefined))).toEqual([]);
    expect(parseArtifacts(makeSpec("d2", "not-an-array"))).toEqual([]);
    expect(parseArtifacts(makeSpec("d3", [{ exports: ["x"] }, null, 42]))).toEqual([]);
  });
});

describe("checkArtifacts", () => {
  it("passes when all declared files and exports exist", async () => {
    const spec = makeSpec("crawler-logger", [
      { path: "middleware.ts", exports: ["onRequest"] },
      { path: "scripts/export-log.mjs" },
      { path: "src/lib/bots.ts", exports: ["BOT_SIGNATURES"] },
    ]);
    const result = await checkArtifacts([spec], fixtureDir, true);
    expect(result.findings).toEqual([]);
    expect(result.total).toBe(5); // 3 paths + 2 exports
    expect(result.checked).toBe(5);
  });

  it("reports a missing file as an error finding", async () => {
    const spec = makeSpec("crawler-logger", [{ path: "does/not/exist.ts" }]);
    const result = await checkArtifacts([spec], fixtureDir, true);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({
      type: "missing",
      category: "artifact",
      specId: "crawler-logger",
      severity: "error",
    });
    expect(result.findings[0]!.expected).toContain("does/not/exist.ts");
  });

  it("reports a missing export as an error finding", async () => {
    const spec = makeSpec("crawler-logger", [
      { path: "src/lib/bots.ts", exports: ["BOT_SIGNATURES", "NOT_EXPORTED"] },
    ]);
    const result = await checkArtifacts([spec], fixtureDir, true);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]).toMatchObject({ type: "missing", category: "artifact" });
    expect(result.findings[0]!.expected).toContain("NOT_EXPORTED");
    // non-exported internal symbols must not satisfy the check
  });

  it("verifies exports in .mjs files", async () => {
    const spec = makeSpec("d1", [{ path: "scripts/export-log.mjs", exports: ["exportLog"] }]);
    const result = await checkArtifacts([spec], fixtureDir, true);
    expect(result.findings).toEqual([]);
    expect(result.checked).toBe(2);
  });

  it("skips export checks with a note when ts-morph is unavailable", async () => {
    const spec = makeSpec("crawler-logger", [
      { path: "src/lib/bots.ts", exports: ["BOT_SIGNATURES"] },
    ]);
    const result = await checkArtifacts([spec], fixtureDir, false);
    expect(result.findings).toEqual([]);
    // The export assertion is excluded from totals, never vacuously passed
    expect(result.total).toBe(1);
    expect(result.checked).toBe(1);
    expect(result.notes.some((n) => n.includes("export checks skipped"))).toBe(true);
  });

  it("does not count export assertions for files that are missing", async () => {
    const spec = makeSpec("d1", [{ path: "gone.ts", exports: ["a", "b"] }]);
    const result = await checkArtifacts([spec], fixtureDir, true);
    expect(result.findings).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it("returns empty result for specs without artifacts", async () => {
    const result = await checkArtifacts([makeSpec("d1", undefined)], fixtureDir, true);
    expect(result.findings).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.notes).toEqual([]);
  });
});

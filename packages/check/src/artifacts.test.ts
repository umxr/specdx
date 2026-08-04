import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { parseArtifacts, checkArtifacts } from "./artifacts.js";
import type { ParsedSpec } from "@specdx/core";

const fixtureDir = join(import.meta.dirname, "../test/fixtures-artifacts");

function makeSpec(id: string, artifacts: unknown, status = "approved"): ParsedSpec {
  return {
    filePath: `/specs/${id}.md`,
    frontmatter: {
      id,
      type: "technical-design",
      title: `Spec ${id}`,
      status,
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

  it("reports missing artifacts of a draft spec as pending, not an error (issue #17)", async () => {
    const spec = makeSpec("planned", [{ path: "api/cron/drain.ts" }], "draft");
    const result = await checkArtifacts([spec], fixtureDir, true);

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]!.severity).toBe("info");
    expect(result.findings[0]!.expected).toContain("api/cron/drain.ts");
    // The absence is the expected state, so it must not drag down the score
    expect(result.total).toBe(0);
    expect(result.pending).toBe(1);
  });

  it("phrases the pending suggestion for a planned file, not a defect (issue #17)", async () => {
    const spec = makeSpec("planned", [{ path: "api/cron/drain.ts" }], "draft");
    const result = await checkArtifacts([spec], fixtureDir, true);
    const suggestion = result.findings[0]!.suggestion ?? "";
    expect(suggestion).toMatch(/planned|not yet/i);
    expect(suggestion).not.toMatch(/^Create /);
  });

  it.each(["draft", "review", "superseded"])(
    "does not enforce missing artifacts for status %s (issue #17)",
    async (status) => {
      const spec = makeSpec("s", [{ path: "nope.ts" }], status);
      const result = await checkArtifacts([spec], fixtureDir, true);
      expect(result.findings[0]!.severity).toBe("info");
      expect(result.total).toBe(0);
    },
  );

  it("still errors on missing artifacts of an approved spec (issue #17)", async () => {
    const spec = makeSpec("built", [{ path: "nope.ts" }], "approved");
    const result = await checkArtifacts([spec], fixtureDir, true);
    expect(result.findings[0]!.severity).toBe("error");
    expect(result.total).toBe(1);
    expect(result.pending).toBe(0);
  });

  it("verifies artifacts that do exist regardless of spec status (issue #17)", async () => {
    const spec = makeSpec(
      "planned",
      [{ path: "middleware.ts", exports: ["onRequest"] }, { path: "missing.ts" }],
      "draft",
    );
    const result = await checkArtifacts([spec], fixtureDir, true);

    // The existing file and its export are still real, verified assertions
    expect(result.total).toBe(2);
    expect(result.findings.filter((f) => f.severity === "error")).toHaveLength(0);
    expect(result.pending).toBe(1);
  });

  it("treats a missing export on an existing file as pending for a draft spec (issue #19)", async () => {
    // The spec plans to add an export to a file that already exists — the same
    // situation as a planned file, reached by a different path.
    const spec = makeSpec(
      "planned",
      [{ path: "middleware.ts", exports: ["onRequest", "logBotHit"] }],
      "draft",
    );
    const result = await checkArtifacts([spec], fixtureDir, true);

    expect(result.findings.filter((f) => f.severity === "error")).toHaveLength(0);
    const planned = result.findings.find((f) => f.expected.includes("logBotHit"))!;
    expect(planned.severity).toBe("info");
    expect(planned.type).toBe("pending");
    expect(planned.suggestion ?? "").toMatch(/planned|not yet/i);
    expect(planned.suggestion ?? "").not.toMatch(/^Export /);

    // The file and its one real export are still verified assertions
    expect(result.total).toBe(2);
    expect(result.pending).toBe(1);
  });

  it("still errors on a missing export for an approved spec (issue #19)", async () => {
    const spec = makeSpec(
      "built",
      [{ path: "middleware.ts", exports: ["onRequest", "logBotHit"] }],
      "approved",
    );
    const result = await checkArtifacts([spec], fixtureDir, true);

    const missing = result.findings.find((f) => f.expected.includes("logBotHit"))!;
    expect(missing.severity).toBe("error");
    expect(result.total).toBe(3);
    expect(result.pending).toBe(0);
  });

  it("counts exports that exist for a draft spec (issue #19)", async () => {
    const spec = makeSpec("planned", [{ path: "middleware.ts", exports: ["onRequest"] }], "draft");
    const result = await checkArtifacts([spec], fixtureDir, true);

    expect(result.findings).toEqual([]);
    expect(result.total).toBe(2);
    expect(result.pending).toBe(0);
  });

  it("discloses pending artifacts in the notes (issue #17)", async () => {
    const spec = makeSpec("planned", [{ path: "a.ts" }, { path: "b.ts" }], "draft");
    const result = await checkArtifacts([spec], fixtureDir, true);
    expect(result.notes.some((n) => /2 declared artifact/i.test(n) && /pending/i.test(n))).toBe(
      true,
    );
  });

  it("returns empty result for specs without artifacts", async () => {
    const result = await checkArtifacts([makeSpec("d1", undefined)], fixtureDir, true);
    expect(result.findings).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.notes).toEqual([]);
  });
});

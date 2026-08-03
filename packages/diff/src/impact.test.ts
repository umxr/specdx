import { buildRelationResolver } from "@specdx/core";
import { parseSpecFromString } from "@specdx/core";
import type { SdxConfig } from "@specdx/schema";
import { analyzeImpact } from "./impact.js";
import type { SpecDiff } from "./types.js";

const makeConfig = (specs: SdxConfig["specs"]): SdxConfig => ({ version: "1.0", specs });

type Parsed = Awaited<ReturnType<typeof parseSpecFromString>>;

/** Build a relation resolver, grouping specs by the config entry they came from. */
function relationsFor(config: SdxConfig, specs: Parsed[]) {
  const byEntry = new Map<string, Parsed[]>();
  for (const [key, entry] of Object.entries(config.specs)) {
    byEntry.set(
      key,
      specs.filter((s) => s.filePath === entry.path),
    );
  }
  return buildRelationResolver(config, byEntry);
}

function makeSpecDiff(specId: string, sections: { heading: string }[] = []): SpecDiff {
  return {
    specId,
    filePath: `specs/${specId}.md`,
    frontmatter: [],
    sections: sections.map((s) => ({ heading: s.heading, type: "modified" as const })),
    summary: `Changed ${specId}`,
  };
}

async function makeSpec(
  id: string,
  opts: {
    updated?: string;
    created?: string;
    references?: { id: string; relationship: string }[];
  } = {},
): Promise<Awaited<ReturnType<typeof parseSpecFromString>>> {
  const created = opts.created ?? "2026-01-01";
  const updatedLine = opts.updated ? `updated: "${opts.updated}"\n` : "";
  const refsLine = opts.references
    ? "references:\n" +
      opts.references
        .map((r) => `  - id: "${r.id}"\n    relationship: "${r.relationship}"`)
        .join("\n") +
      "\n"
    : "";
  const raw = `---
id: ${id}
type: prd
title: "Spec ${id}"
status: draft
version: "0.1"
created: "${created}"
${updatedLine}${refsLine}authors: ["alice"]
---

## Goals

Some goals.
`;
  return parseSpecFromString(raw, `specs/${id}.md`);
}

describe("analyzeImpact", () => {
  it("returns empty downstream for spec with no dependents", async () => {
    const config = makeConfig({
      a: { path: "specs/a.md", type: "prd" },
    });
    const specA = await makeSpec("a");
    const diff = makeSpecDiff("a");

    const result = analyzeImpact("a", diff, relationsFor(config, [specA]), [specA]);

    expect(result.changedSpec).toBe("a");
    expect(result.downstream).toHaveLength(0);
    expect(result.totalAffected).toBe(0);
  });

  it("returns single downstream spec at distance 1 (A→B, A changes)", async () => {
    const config = makeConfig({
      a: { path: "specs/a.md", type: "prd" },
      b: { path: "specs/b.md", type: "technical-design", requires: ["a"] },
    });
    const specA = await makeSpec("a");
    const specB = await makeSpec("b");
    const diff = makeSpecDiff("a");

    const result = analyzeImpact("a", diff, relationsFor(config, [specA, specB]), [specA, specB]);

    expect(result.changedSpec).toBe("a");
    expect(result.downstream).toHaveLength(1);
    expect(result.totalAffected).toBe(1);

    const bImpact = result.downstream[0];
    expect(bImpact).toBeDefined();
    expect(bImpact!.specId).toBe("b");
    expect(bImpact!.distance).toBe(1);
    expect(bImpact!.filePath).toBe("specs/b.md");
  });

  it("returns transitive downstream specs with correct distances (A→B→C)", async () => {
    const config = makeConfig({
      a: { path: "specs/a.md", type: "prd" },
      b: { path: "specs/b.md", type: "technical-design", requires: ["a"] },
      c: { path: "specs/c.md", type: "test-plan", requires: ["b"] },
    });
    const specA = await makeSpec("a");
    const specB = await makeSpec("b");
    const specC = await makeSpec("c");
    const diff = makeSpecDiff("a");

    const result = analyzeImpact("a", diff, relationsFor(config, [specA, specB, specC]), [
      specA,
      specB,
      specC,
    ]);

    expect(result.changedSpec).toBe("a");
    expect(result.downstream).toHaveLength(2);
    expect(result.totalAffected).toBe(2);

    const byId = Object.fromEntries(result.downstream.map((d) => [d.specId, d]));
    expect(byId["b"]!.distance).toBe(1);
    expect(byId["c"]!.distance).toBe(2);
  });

  it("calculates low staleness for recently updated downstream spec", async () => {
    const config = makeConfig({
      a: { path: "specs/a.md", type: "prd" },
      b: { path: "specs/b.md", type: "technical-design", requires: ["a"] },
    });
    const specA = await makeSpec("a");
    // B was updated yesterday — very fresh
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const specB = await makeSpec("b", { updated: yesterday.toISOString().split("T")[0] });
    const diff = makeSpecDiff("a");

    const result = analyzeImpact(
      "a",
      diff,
      relationsFor(config, [specA, specB]),
      [specA, specB],
      14,
    );

    const bImpact = result.downstream.find((d) => d.specId === "b");
    expect(bImpact).toBeDefined();
    // With daysSinceUpdate ≈ 1 and threshold=14, the daysSinceUpdate/threshold term ≈ 0.036
    // staleness should be low (well below 0.5)
    expect(bImpact!.staleness).toBeGreaterThanOrEqual(0);
    expect(bImpact!.staleness).toBeLessThan(0.5);
  });

  it("calculates high staleness for old downstream spec", async () => {
    const config = makeConfig({
      a: { path: "specs/a.md", type: "prd" },
      b: { path: "specs/b.md", type: "technical-design", requires: ["a"] },
    });
    const specA = await makeSpec("a");
    // B was last updated 100 days ago — very stale
    const longAgo = new Date();
    longAgo.setDate(longAgo.getDate() - 100);
    const specB = await makeSpec("b", { updated: longAgo.toISOString().split("T")[0] });
    const diff = makeSpecDiff("a");

    const result = analyzeImpact(
      "a",
      diff,
      relationsFor(config, [specA, specB]),
      [specA, specB],
      14,
    );

    const bImpact = result.downstream.find((d) => d.specId === "b");
    expect(bImpact).toBeDefined();
    // With daysSinceUpdate=100 and threshold=14, the time term alone exceeds 1 so it gets clamped
    expect(bImpact!.staleness).toBeGreaterThan(0.5);
    expect(bImpact!.staleness).toBeLessThanOrEqual(1);
  });

  it("scores higher staleness when structural sections changed vs minor sections", async () => {
    const config = makeConfig({
      a: { path: "specs/a.md", type: "prd" },
      b: { path: "specs/b.md", type: "technical-design", requires: ["a"] },
    });
    const specA = await makeSpec("a");
    // Use a neutral date 7 days ago — exactly at 0.5 threshold factor
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const specB = await makeSpec("b", { updated: sevenDaysAgo.toISOString().split("T")[0] });

    const structuralDiff = makeSpecDiff("a", [{ heading: "Architecture" }, { heading: "Goals" }]);
    const minorDiff = makeSpecDiff("a", [
      { heading: "Open Questions" },
      { heading: "Open Questions" },
    ]);

    const resultStructural = analyzeImpact(
      "a",
      structuralDiff,
      relationsFor(config, [specA, specB]),
      [specA, specB],
      14,
    );
    const resultMinor = analyzeImpact(
      "a",
      minorDiff,
      relationsFor(config, [specA, specB]),
      [specA, specB],
      14,
    );

    const structuralScore = resultStructural.downstream.find((d) => d.specId === "b")!.staleness;
    const minorScore = resultMinor.downstream.find((d) => d.specId === "b")!.staleness;

    // All sections structural → 0.3 weight fully applied; none structural → 0 for that term
    expect(structuralScore).toBeGreaterThan(minorScore);
  });

  it("uses created date when updated is absent for staleness calculation", async () => {
    const config = makeConfig({
      a: { path: "specs/a.md", type: "prd" },
      b: { path: "specs/b.md", type: "technical-design", requires: ["a"] },
    });
    const specA = await makeSpec("a");
    // No updated field — falls back to created which is very old
    const specB = await makeSpec("b", { created: "2020-01-01" });
    const diff = makeSpecDiff("a");

    const result = analyzeImpact(
      "a",
      diff,
      relationsFor(config, [specA, specB]),
      [specA, specB],
      14,
    );

    const bImpact = result.downstream.find((d) => d.specId === "b");
    expect(bImpact).toBeDefined();
    expect(bImpact!.lastUpdated).toBe("2020-01-01");
    // Very old → high staleness
    expect(bImpact!.staleness).toBeGreaterThan(0.5);
  });

  it("includes reason string for each downstream impact", async () => {
    const config = makeConfig({
      a: { path: "specs/a.md", type: "prd" },
      b: { path: "specs/b.md", type: "technical-design", requires: ["a"] },
    });
    const specA = await makeSpec("a");
    const specB = await makeSpec("b");
    const diff = makeSpecDiff("a", [{ heading: "Goals" }]);

    const result = analyzeImpact("a", diff, relationsFor(config, [specA, specB]), [specA, specB]);

    const bImpact = result.downstream[0];
    expect(bImpact).toBeDefined();
    expect(typeof bImpact!.reason).toBe("string");
    expect(bImpact!.reason.length).toBeGreaterThan(0);
  });

  it("staleness is clamped between 0 and 1", async () => {
    const config = makeConfig({
      a: { path: "specs/a.md", type: "prd" },
      b: { path: "specs/b.md", type: "technical-design", requires: ["a"] },
    });
    const specA = await makeSpec("a");
    const extremelyOld = await makeSpec("b", { created: "2000-01-01" });
    const diff = makeSpecDiff("a", [
      { heading: "Architecture" },
      { heading: "Goals" },
      { heading: "Features" },
    ]);

    const result = analyzeImpact(
      "a",
      diff,
      relationsFor(config, [specA, extremelyOld]),
      [specA, extremelyOld],
      1,
    );

    const bImpact = result.downstream.find((d) => d.specId === "b");
    expect(bImpact!.staleness).toBeGreaterThanOrEqual(0);
    expect(bImpact!.staleness).toBeLessThanOrEqual(1);
  });
  it("finds downstream when config entry keys differ from spec ids (ADR: unification)", async () => {
    // The classic shape: entry keys "prd"/"design", spec ids "prd-001"/"design-001".
    // Impact used to BFS entry-keyed graph edges with a spec id and silently
    // return nothing, so downstream impact was invisible for most projects.
    const config = makeConfig({
      prd: { path: "specs/prd-001.md", type: "prd" },
      design: { path: "specs/design-001.md", type: "technical-design", requires: ["prd"] },
    });
    const prd = await makeSpec("prd-001");
    const design = await makeSpec("design-001");
    const diff = makeSpecDiff("prd-001", [{ heading: "Goals" }]);

    const result = analyzeImpact("prd-001", diff, relationsFor(config, [prd, design]), [
      prd,
      design,
    ]);

    expect(result.totalAffected).toBe(1);
    expect(result.downstream[0]!.specId).toBe("design-001");
  });

  it("finds downstream declared only via frontmatter references (ADR: unification)", async () => {
    const config = makeConfig({
      prd: { path: "specs/prd-001.md", type: "prd" },
      design: { path: "specs/design-001.md", type: "technical-design" },
    });
    const prd = await makeSpec("prd-001");
    const design = await makeSpec("design-001", {
      references: [{ id: "prd-001", relationship: "depends-on" }],
    });
    const diff = makeSpecDiff("prd-001", [{ heading: "Goals" }]);

    const result = analyzeImpact("prd-001", diff, relationsFor(config, [prd, design]), [
      prd,
      design,
    ]);

    expect(result.totalAffected).toBe(1);
    expect(result.downstream[0]!.specId).toBe("design-001");
  });
});

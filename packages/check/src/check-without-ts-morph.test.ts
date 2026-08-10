import { describe, it, expect, vi } from "vitest";
import { join } from "node:path";
import type { ParsedSpec } from "@specdx/core";

// A whole file to itself, because the mock has to be absent from every other
// check test. `ts-morph` is an optional peer dependency, and the interesting
// state is the one a user reaches with `npx specdx check` — installed nowhere.
vi.mock("ts-morph", () => {
  throw new Error("Cannot find package 'ts-morph'");
});

const { runCheck } = await import("./check.js");

const fixtureDir = join(import.meta.dirname, "../test/fixtures");

function testPlan(): ParsedSpec {
  return {
    filePath: "specs/test-plan.md",
    frontmatter: {
      id: "tp-001",
      type: "test-plan",
      title: "Test Plan",
      status: "approved",
      version: "1.0",
      created: "2026-01-01",
      authors: ["dev"],
    },
    content: "## Test Cases\n\n- **TC1**: returns an empty list for a new customer\n",
    sections: ["Test Cases"],
    parsedSections: [],
    valid: true,
    validationErrors: null,
  } as unknown as ParsedSpec;
}

describe("runCheck without ts-morph", () => {
  // Route and type extraction were guarded and degraded to a note; test
  // extraction was not, so one test-plan spec turned the note into an unhandled
  // throw and a stack trace — including through MCP's `sdx_check`.
  it("skips test extraction with a note instead of throwing", async () => {
    const result = await runCheck([testPlan()], fixtureDir);

    expect(result.notes.some((n) => n.includes("test extraction skipped"))).toBe(true);
    expect(result.score.assessed).toBe(false);
    expect(result.findings).toEqual([]);
  });

  it("names all three skipped categories, not two", async () => {
    const result = await runCheck([testPlan()], fixtureDir);
    const note = result.notes.find((n) => n.includes("ts-morph is not installed"));

    expect(note).toBeDefined();
    expect(note).toContain("route, type and test extraction skipped");
  });

  // Found re-verifying audit run 4's N2 fix: tests were skipped without
  // ts-morph but types were not — every spec'd type was matched against an
  // empty extraction and reported unimplemented, when it was never looked at.
  it("skips type matching too when there is no ts-morph and no Prisma schema", async () => {
    const design: ParsedSpec = {
      filePath: "specs/technical-design.md",
      frontmatter: {
        id: "td-001",
        type: "technical-design",
        title: "Design",
        status: "approved",
        version: "1.0",
        created: "2026-01-01",
        authors: ["dev"],
      },
      content: "## Data Model\n\n### Widget\n- `id`: string\n- `name`: string\n",
      sections: ["Data Model"],
      parsedSections: [],
      valid: true,
      validationErrors: null,
    } as unknown as ParsedSpec;

    // The fixture *root* holds a schema.prisma (Prisma extraction works
    // without ts-morph, so types stay assessable there); this subdir has none.
    const noSchemaDir = join(fixtureDir, "nextjs-app", "api", "posts");
    const result = await runCheck([design], noSchemaDir);

    expect(result.findings.filter((f) => f.category === "type")).toEqual([]);
    expect(result.score.byCategory["types"]).toEqual({ matched: 0, total: 0 });
    expect(result.score.assessed).toBe(false);
  });
});

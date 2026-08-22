import { describe, it, expect } from "vitest";
import { join } from "node:path";
import { runCheck } from "./check.js";
import type { ParsedSpec } from "@specdx/core";

/** Helper to build a minimal ParsedSpec with the given frontmatter and content. */
function makeSpec(
  overrides: Partial<ParsedSpec["frontmatter"]> & { type: string; id: string },
  content: string,
): ParsedSpec {
  return {
    filePath: `/fake/${overrides.id}.md`,
    frontmatter: {
      id: overrides.id,
      type: overrides.type as ParsedSpec["frontmatter"]["type"],
      title: overrides.title ?? overrides.id,
      status: "approved" as const,
      version: "1.0.0",
      created: "2026-01-01",
      authors: ["test"],
      ...overrides,
    },
    content,
    sections: [],
    parsedSections: [],
    valid: true,
    validationErrors: null,
  };
}

const FIXTURES_DIR = join(import.meta.dirname, "..", "test", "fixtures");

describe("runCheck", () => {
  it("reports not-assessed when no specs match check categories (issue #6)", async () => {
    const specs: ParsedSpec[] = [
      makeSpec({ id: "prd-001", type: "prd" }, "# Some PRD\n\nJust a product doc."),
      makeSpec({ id: "story-001", type: "user-story" }, "# A user story\n\nAs a user..."),
    ];

    const result = await runCheck(specs, FIXTURES_DIR);

    expect(result.findings).toHaveLength(0);
    expect(result.score.assessed).toBe(false);
    expect(result.summary).toContain("not assessed");
    expect(result.summary).not.toContain("100%");
  });

  it("reports not-assessed when specs array is empty", async () => {
    const result = await runCheck([], FIXTURES_DIR);

    expect(result.findings).toHaveLength(0);
    expect(result.score.assessed).toBe(false);
    expect(result.scanned.codeRoutes).toBeNull();
    expect(result.scanned.codeTypes).toBeNull();
    expect(result.scanned.codeTests).toBeNull();
  });

  it("reports missing routes for api-contract spec when project has no matching routes", async () => {
    const spec = makeSpec(
      { id: "api-001", type: "api-contract" },
      [
        "## Endpoints",
        "",
        "### GET /api/widgets",
        "List all widgets",
        "",
        "### POST /api/widgets",
        "Create a widget",
      ].join("\n"),
    );

    // Point to an empty dir — no route files will be found
    const emptyDir = join(FIXTURES_DIR, "nextjs-app", "api", "posts");
    const result = await runCheck([spec], emptyDir, { framework: "express" });

    const missing = result.findings.filter((f) => f.type === "missing" && f.category === "route");
    expect(missing).toHaveLength(2);
    expect(missing[0]!.expected).toContain("GET /api/widgets");
    expect(missing[1]!.expected).toContain("POST /api/widgets");
    expect(result.score.overall).toBe(0);
    expect(result.score.byCategory["routes"]).toEqual({ matched: 0, total: 2 });
  });

  it("reports missing types for technical-design spec against empty project", async () => {
    const spec = makeSpec(
      { id: "td-001", type: "technical-design" },
      [
        "## Data Model",
        "",
        "### Widget",
        "- `id`: string",
        "- `name`: string",
        "- `color?`: string",
      ].join("\n"),
    );

    // Point to a dir with no type files
    const emptyDir = join(FIXTURES_DIR, "nextjs-app", "api", "posts");
    const result = await runCheck([spec], emptyDir);

    const missing = result.findings.filter((f) => f.type === "missing" && f.category === "type");
    expect(missing).toHaveLength(1);
    expect(missing[0]!.expected).toContain("Widget");
    // Audit run 4, N2: the denominator counts fields, and the one finding for
    // the wholly-missing type is weighted by its field count — a project that
    // implements none of the model scores 0, not (N-1)/N.
    expect(result.score.byCategory["types"]).toEqual({ matched: 0, total: 3 });
    expect(result.score.overall).toBe(0);
  });

  it("reports missing tests for test-plan spec against empty project", async () => {
    const spec = makeSpec(
      { id: "tp-001", type: "test-plan" },
      [
        "## Test Cases",
        "",
        "### Unit Tests",
        "- should validate widget name",
        "- should reject empty name",
      ].join("\n"),
    );

    const emptyDir = join(FIXTURES_DIR, "nextjs-app", "api", "posts");
    const result = await runCheck([spec], emptyDir);

    const missing = result.findings.filter((f) => f.type === "missing" && f.category === "test");
    expect(missing).toHaveLength(2);
    expect(result.score.byCategory["tests"]).toEqual({ matched: 0, total: 2 });
  });

  it("matches express routes from fixtures against an api-contract spec", async () => {
    const spec = makeSpec(
      { id: "api-002", type: "api-contract" },
      [
        "## Endpoints",
        "",
        "### GET /api/users",
        "List users",
        "",
        "### POST /api/users",
        "Create user",
        "",
        "### GET /api/users/:id",
        "Get single user",
        "",
        "### DELETE /api/users/:id",
        "Delete user",
      ].join("\n"),
    );

    const result = await runCheck([spec], FIXTURES_DIR, { framework: "express" });

    const missing = result.findings.filter((f) => f.type === "missing" && f.category === "route");
    // Express fixture has GET /users, POST /users, GET /users/:id, DELETE /users/:id, PUT /users/:id/profile
    // All 4 spec endpoints should be matched (under /api prefix from app.use)
    expect(missing).toHaveLength(0);

    const extra = result.findings.filter((f) => f.type === "extra" && f.category === "route");
    // At least PUT /api/users/:id/profile from express-app.ts is extra.
    // The extractor also picks up routes from hono-app.ts in the same fixtures dir.
    expect(extra.length).toBeGreaterThanOrEqual(1);
    expect(extra.some((f) => f.actual?.includes("PUT"))).toBe(true);
  });

  it("matches types from fixtures against a technical-design spec", async () => {
    const spec = makeSpec(
      { id: "td-002", type: "technical-design" },
      [
        "## Data Model",
        "",
        "### User",
        "- `id`: string",
        "- `name`: string",
        "- `email`: string",
        "- `role`: string",
        "- `createdAt`: Date",
        "",
        "### Post",
        "- `id`: string",
        "- `title`: string",
        "- `content`: string",
        "- `authorId`: string",
        "- `publishedAt?`: Date",
      ].join("\n"),
    );

    const result = await runCheck([spec], FIXTURES_DIR);

    // All types and fields should be matched from the fixtures/types.ts file
    const missing = result.findings.filter((f) => f.type === "missing" && f.category === "type");
    expect(missing).toHaveLength(0);
    expect(result.score.byCategory["types"]!.total).toBe(10); // 5 User fields + 5 Post fields
  });

  it("matches tests from fixtures against a test-plan spec", async () => {
    const spec = makeSpec(
      { id: "tp-002", type: "test-plan" },
      [
        "## Test Cases",
        "",
        "### UserService",
        "- should create a new user",
        "- should list all users",
        "",
        "### PostService",
        "- should create a post",
      ].join("\n"),
    );

    const result = await runCheck([spec], FIXTURES_DIR);

    const missing = result.findings.filter((f) => f.type === "missing" && f.category === "test");
    // All 3 spec test cases have matches in sample-tests.ts
    expect(missing).toHaveLength(0);
    expect(result.score.byCategory["tests"]!.total).toBe(3);
  });

  it("handles mixed spec types in a single run", async () => {
    const apiSpec = makeSpec(
      { id: "api-003", type: "api-contract" },
      ["## Endpoints", "", "### GET /api/users", "List users"].join("\n"),
    );

    const designSpec = makeSpec(
      { id: "td-003", type: "technical-design" },
      ["## Data Model", "", "### User", "- `id`: string", "- `name`: string"].join("\n"),
    );

    const testSpec = makeSpec(
      { id: "tp-003", type: "test-plan" },
      ["## Test Cases", "", "- should create a new user"].join("\n"),
    );

    const result = await runCheck([apiSpec, designSpec, testSpec], FIXTURES_DIR, {
      framework: "express",
    });

    // All three categories should have been checked
    expect(result.score.byCategory["routes"]).toBeDefined();
    expect(result.score.byCategory["types"]).toBeDefined();
    expect(result.score.byCategory["tests"]).toBeDefined();

    expect(result.score.byCategory["routes"]!.total).toBe(1);
    expect(result.score.byCategory["types"]!.total).toBe(2);
    expect(result.score.byCategory["tests"]!.total).toBe(1);
  });

  it("respects framework config to use only the specified extractor", async () => {
    const spec = makeSpec(
      { id: "api-004", type: "api-contract" },
      ["## Endpoints", "", "### GET /api/users", "List users"].join("\n"),
    );

    // With nextjs framework, it won't find Express routes
    const result = await runCheck([spec], FIXTURES_DIR, { framework: "nextjs" });
    const missing = result.findings.filter((f) => f.type === "missing" && f.category === "route");

    // Next.js extractor looks in app/ dir, won't match the Express fixture routes
    expect(missing).toHaveLength(1);
    expect(missing[0]!.expected).toContain("GET /api/users");
  });

  it("includes spec id in all findings", async () => {
    const spec = makeSpec(
      { id: "api-unique-id", type: "api-contract" },
      ["## Endpoints", "", "### GET /nonexistent/route", "A missing endpoint"].join("\n"),
    );

    const result = await runCheck([spec], FIXTURES_DIR, { framework: "express" });

    for (const finding of result.findings) {
      expect(finding.specId).toBe("api-unique-id");
    }
  });

  it("declared artifacts make an otherwise uncheckable project assessable (issue #15)", async () => {
    const artifactsDir = join(import.meta.dirname, "..", "test", "fixtures-artifacts");
    const specs: ParsedSpec[] = [
      makeSpec(
        {
          id: "crawler-logger",
          type: "technical-design",
          artifacts: [
            { path: "middleware.ts", exports: ["onRequest"] },
            { path: "src/lib/bots.ts", exports: ["BOT_SIGNATURES"] },
          ],
        } as never,
        "# Crawler Logger\n\nNo Data Model section here.",
      ),
    ];

    const result = await runCheck(specs, artifactsDir);

    expect(result.score.assessed).toBe(true);
    expect(result.findings.filter((f) => f.category === "artifact")).toHaveLength(0);
    expect(result.scanned.artifacts).toBe(4);
    expect(result.summary).toContain("100%");
  });

  it("a draft spec's planned artifacts do not fail the check (issue #17)", async () => {
    const artifactsDir = join(import.meta.dirname, "..", "test", "fixtures-artifacts");
    const specs: ParsedSpec[] = [
      makeSpec(
        {
          id: "crawler-log-drain",
          type: "technical-design",
          status: "draft",
          artifacts: [{ path: "api/cron/drain.ts" }, { path: "middleware.ts" }],
        } as never,
        "# Drain job",
      ),
    ];

    const result = await runCheck(specs, artifactsDir);

    // Nothing at error severity, so the CLI exits 0 and the gate stays green
    expect(result.findings.filter((f) => f.severity === "error")).toHaveLength(0);
    expect(result.scanned.artifactsPending).toBe(1);
    expect(result.scanned.artifacts).toBe(1);
    expect(result.notes.some((n) => /pending/i.test(n))).toBe(true);
  });

  it("the same spec approved does fail on its unbuilt artifacts (issue #17)", async () => {
    const artifactsDir = join(import.meta.dirname, "..", "test", "fixtures-artifacts");
    const specs: ParsedSpec[] = [
      makeSpec(
        {
          id: "crawler-log-drain",
          type: "technical-design",
          status: "approved",
          artifacts: [{ path: "api/cron/drain.ts" }, { path: "middleware.ts" }],
        } as never,
        "# Drain job",
      ),
    ];

    const result = await runCheck(specs, artifactsDir);

    expect(result.findings.filter((f) => f.severity === "error")).toHaveLength(1);
    expect(result.scanned.artifactsPending).toBe(0);
    expect(result.score.overall).toBe(50);
  });

  it("reports missing declared artifacts as findings", async () => {
    const artifactsDir = join(import.meta.dirname, "..", "test", "fixtures-artifacts");
    const specs: ParsedSpec[] = [
      makeSpec(
        {
          id: "crawler-logger",
          type: "technical-design",
          artifacts: [{ path: "not/here.ts" }],
        } as never,
        "# Crawler Logger",
      ),
    ];

    const result = await runCheck(specs, artifactsDir);

    const artifactFindings = result.findings.filter((f) => f.category === "artifact");
    expect(artifactFindings).toHaveLength(1);
    expect(artifactFindings[0]!.severity).toBe("error");
    expect(result.score.assessed).toBe(true);
    expect(result.score.overall).toBe(0);
  });

  it("summary string includes score, errors, and warnings", async () => {
    const spec = makeSpec(
      { id: "api-005", type: "api-contract" },
      ["## Endpoints", "", "### GET /nowhere", "Does not exist"].join("\n"),
    );

    const result = await runCheck([spec], FIXTURES_DIR, { framework: "express" });

    expect(result.summary).toMatch(/\d+% implementation coverage/);
    expect(result.summary).toMatch(/\d+ errors/);
    expect(result.summary).toMatch(/\d+ warnings/);
  });
});

describe("runCheck — a Data Model it could not read (F8, issue #38)", () => {
  it("says nothing about a Data Model written as prose", async () => {
    // A prose Data Model is not a failed field list. Warning once per spec per
    // run, with no edit short of restructuring valid prose to clear it, taught
    // people to ignore every warning `check` prints (issue #38).
    const specs: ParsedSpec[] = [
      makeSpec(
        { id: "td", type: "technical-design" },
        [
          "## Data Model",
          "",
          "### User",
          "",
          "- Note: stored in Postgres, partitioned by tenant",
        ].join("\n"),
      ),
    ];

    const result = await runCheck(specs, FIXTURES_DIR, { framework: "express" });

    expect(result.notes.some((n) => /data model/i.test(n))).toBe(false);
  });

  it("names field lines that belong to no type heading", async () => {
    // Still worth saying: these lines *are* field declarations, and they left
    // the denominator without contributing to it.
    const specs: ParsedSpec[] = [
      makeSpec(
        { id: "td-loose", type: "technical-design" },
        ["## Data Model", "", "- id: string", "- email: string"].join("\n"),
      ),
    ];

    const result = await runCheck(specs, FIXTURES_DIR, { framework: "express" });

    const note = result.notes.find((n) => /data model/i.test(n));
    expect(note).toContain("td-loose");
    expect(note).toContain("### TypeName");
    expect(note).toContain("- id: string");
  });

  it("says nothing when the Data Model parses", async () => {
    const specs: ParsedSpec[] = [
      makeSpec(
        { id: "td", type: "technical-design" },
        ["## Data Model", "", "### User", "", "- id: string"].join("\n"),
      ),
    ];

    const result = await runCheck(specs, FIXTURES_DIR, { framework: "express" });

    expect(result.notes.some((n) => /data model/i.test(n))).toBe(false);
  });

  it("reads a Data Model whose fields carry descriptions (issue #51)", async () => {
    const specs: ParsedSpec[] = [
      makeSpec(
        { id: "td-desc", type: "technical-design" },
        [
          "## Data Model",
          "",
          "### Budget",
          "",
          "- key: string — the quantity's name",
          "- bytes: number — the ceiling",
        ].join("\n"),
      ),
    ];

    const result = await runCheck(specs, FIXTURES_DIR, { framework: "express" });

    expect(result.score.byCategory["types"]).toEqual({ matched: 0, total: 2 });
    expect(result.notes.some((n) => /data model/i.test(n))).toBe(false);
  });
});

describe("runCheck — status governs types as it governs artifacts (issue #52)", () => {
  const dataModel = [
    "## Data Model",
    "",
    "### Budget",
    "",
    "- key: string — the quantity's name",
    "- bytes: number — the ceiling",
    "",
    "### User",
    "",
    "- id: string",
    "- name: string",
    "- email: string",
    '- role: "admin" | "user"',
    "- createdAt: Date",
  ].join("\n");

  it("holds a draft spec's unimplemented types back instead of failing on them", async () => {
    const spec = makeSpec({ id: "td-draft", type: "technical-design", status: "draft" }, dataModel);

    const result = await runCheck([spec], FIXTURES_DIR, { framework: "express" });

    const budget = result.findings.filter((f) => f.expected === "Type: Budget");
    expect(budget).toHaveLength(1);
    expect(budget[0]!.type).toBe("pending");
    expect(budget[0]!.severity).toBe("info");
    expect(budget[0]!.suggestion).toContain("enforced once the spec is approved");

    // Excluded from the score, exactly as a planned artifact is: the five
    // implemented User fields are the whole denominator.
    expect(result.findings.filter((f) => f.severity === "error")).toHaveLength(0);
    expect(result.score.byCategory["types"]).toEqual({ matched: 5, total: 5 });
    expect(result.scanned.typesPending).toBe(1);
    expect(result.notes.some((n) => /type\(s\) pending/i.test(n))).toBe(true);
  });

  it("fails on the same types once the spec is approved", async () => {
    const spec = makeSpec(
      { id: "td-approved", type: "technical-design", status: "approved" },
      dataModel,
    );

    const result = await runCheck([spec], FIXTURES_DIR, { framework: "express" });

    const budget = result.findings.filter((f) => f.expected === "Type: Budget");
    expect(budget[0]!.type).toBe("missing");
    expect(budget[0]!.severity).toBe("error");
    expect(result.score.byCategory["types"]).toEqual({ matched: 5, total: 7 });
    expect(result.scanned.typesPending).toBe(0);
  });

  it("still checks the fields of a draft spec's type that does exist", async () => {
    // The artifacts rule: a file that exists is a real assertion whatever the
    // status. A type that exists is too — only its absence is deferred.
    const spec = makeSpec(
      { id: "td-draft-fields", type: "technical-design", status: "draft" },
      ["## Data Model", "", "### User", "", "- id: string", "- nickname: string"].join("\n"),
    );

    const result = await runCheck([spec], FIXTURES_DIR, { framework: "express" });

    const missingField = result.findings.filter((f) => /User\.nickname/.test(f.expected));
    expect(missingField).toHaveLength(1);
    expect(missingField[0]!.severity).toBe("warn");
    expect(result.scanned.typesPending).toBe(0);
  });
});

describe("check — an Endpoints section it cannot read", () => {
  // The worst shape of this bug: routes leave the denominator, so understanding
  // *less* raised the score. A bulleted contract reported 0/0 routes, flagged
  // every real route as unspecified, and never mentioned the endpoint that was
  // genuinely absent from the code.
  it("reads a bulleted Endpoints section", async () => {
    const spec = makeSpec(
      { id: "api-bullets", type: "api-contract" },
      [
        "## Endpoints",
        "",
        "- `GET /api/users` — list users",
        "- `GET /nonexistent/route` — not implemented anywhere",
      ].join("\n"),
    );

    const result = await runCheck([spec], FIXTURES_DIR, { framework: "express" });

    expect(result.score.byCategory["routes"]!.total).toBe(2);

    const missing = result.findings.filter((f) => f.type === "missing" && f.category === "route");
    expect(missing).toHaveLength(1);
    expect(missing[0]!.expected).toContain("GET /nonexistent/route");
  });

  it("does not report real routes as unspecified when the bullets parse", async () => {
    const spec = makeSpec(
      { id: "api-bullets-2", type: "api-contract" },
      ["## Endpoints", "", "- GET /api/users — list users"].join("\n"),
    );

    const result = await runCheck([spec], FIXTURES_DIR, { framework: "express" });
    const extras = result.findings.filter(
      (f) => f.type === "extra" && f.category === "route" && f.actual === "GET /api/users",
    );
    expect(extras).toHaveLength(0);
  });

  it("notes a populated Endpoints section that yields nothing", async () => {
    const spec = makeSpec(
      { id: "api-prose", type: "api-contract" },
      ["## Endpoints", "", "See the OpenAPI document in docs/openapi.yaml."].join("\n"),
    );

    const result = await runCheck([spec], FIXTURES_DIR, { framework: "express" });

    expect(result.notes.join("\n")).toContain("no endpoints recognised");
    expect(result.notes.join("\n")).toContain("api-prose");
  });

  it("says nothing when there is no Endpoints section to read", async () => {
    const spec = makeSpec({ id: "api-none", type: "api-contract" }, "## Auth\n\nBearer token.\n");
    const result = await runCheck([spec], FIXTURES_DIR, { framework: "express" });
    expect(result.notes.join("\n")).not.toContain("no endpoints recognised");
  });
});

describe("check — prose sub-headings in a Data Model", () => {
  it("does not demand code implement an explanatory heading", async () => {
    // `### Notes on the model` registered a type called "Notes", reported as an
    // error telling the author to implement it -- a clean spec failing CI.
    const spec = makeSpec(
      { id: "td-prose", type: "technical-design" },
      [
        "## Data Model",
        "",
        "### User",
        "- `id`: string",
        "- `name`: string",
        "",
        "### Notes on the model",
        "",
        "- Users are soft-deleted, never removed.",
        "",
        "### Indexes",
        "",
        "We index on email.",
      ].join("\n"),
    );

    const result = await runCheck([spec], FIXTURES_DIR, { framework: "express" });

    const missingTypes = result.findings.filter(
      (f) => f.type === "missing" && f.category === "type",
    );
    expect(missingTypes.map((f) => f.expected).join(" ")).not.toContain("Notes");
    expect(missingTypes.map((f) => f.expected).join(" ")).not.toContain("Indexes");
  });
});

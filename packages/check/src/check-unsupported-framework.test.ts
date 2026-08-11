import { join } from "node:path";
import { runCheck } from "./check.js";
import type { ParsedSpec } from "@specdx/core";

function apiSpec(content: string): ParsedSpec {
  return {
    filePath: "/fake/api-001.md",
    frontmatter: {
      id: "api-001",
      type: "api-contract" as ParsedSpec["frontmatter"]["type"],
      title: "Users API",
      status: "approved" as const,
      version: "1.0.0",
      created: "2026-01-01",
      authors: ["test"],
    },
    content,
    sections: [],
    parsedSections: [],
    valid: true,
    validationErrors: null,
  };
}

const NESTJS_FIXTURE = join(import.meta.dirname, "..", "test", "fixtures", "nestjs-project");

const SPEC = `## Endpoints

- GET /users — list users
- POST /users — create a user
`;

describe("runCheck on a framework no extractor understands", () => {
  it("does not report every endpoint as missing", async () => {
    // A NestJS project reads as zero routes to the express/hono/nextjs
    // extractors. Reporting the whole contract unimplemented turns "we could
    // not read this" into "you built none of it" — a maximally red first run
    // for most of the market.
    const result = await runCheck([apiSpec(SPEC)], NESTJS_FIXTURE);

    expect(result.findings.filter((f) => f.category === "route")).toEqual([]);
  });

  it("leaves the unreadable routes out of the coverage denominator", async () => {
    const result = await runCheck([apiSpec(SPEC)], NESTJS_FIXTURE);

    expect(result.score.byCategory.routes?.total).toBe(0);
  });

  it("says routes were not assessed rather than passing silently", async () => {
    const result = await runCheck([apiSpec(SPEC)], NESTJS_FIXTURE);

    expect(result.notes.join(" ")).toMatch(/routes were not assessed/i);
  });
});

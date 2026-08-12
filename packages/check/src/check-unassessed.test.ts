import { join } from "node:path";
import { runCheck } from "./check.js";
import type { ParsedSpec } from "@specdx/core";

function spec(type: string, id: string, content: string): ParsedSpec {
  return {
    filePath: `/fake/${id}.md`,
    frontmatter: {
      id,
      type: type as ParsedSpec["frontmatter"]["type"],
      title: id,
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

const FIXTURES_DIR = join(import.meta.dirname, "..", "test", "fixtures");

describe("runCheck reports surfaces it could not assess", () => {
  it("records an Endpoints section it could not parse", async () => {
    // Prose where endpoints were expected. The routes silently leave the
    // denominator, which *raises* the percentage — so the caller must be able
    // to tell that something declared went unassessed.
    const unreadable = spec(
      "api-contract",
      "api-001",
      "## Endpoints\n\nSee the OpenAPI document for the full list.\n",
    );

    const result = await runCheck([unreadable], FIXTURES_DIR, { framework: "express" });

    expect(result.unassessed).toHaveLength(1);
    expect(result.unassessed[0]).toMatch(/api-001/);
  });

  it("records a Data Model it could not parse", async () => {
    const unreadable = spec(
      "technical-design",
      "td-001",
      "## Data Model\n\nThe shape is described in the ERD attached to the ticket.\n",
    );

    const result = await runCheck([unreadable], FIXTURES_DIR);

    expect(result.unassessed.join(" ")).toMatch(/td-001/);
  });

  it("leaves unassessed empty when every declared surface was read", async () => {
    const readable = spec("api-contract", "api-002", "## Endpoints\n\n- GET /users — list users\n");

    const result = await runCheck([readable], FIXTURES_DIR, { framework: "express" });

    expect(result.unassessed).toEqual([]);
  });

  it("does not treat an advisory note as an unassessed surface", async () => {
    // "no specs match check categories" is informational, not a failure to read
    // something the author declared.
    const result = await runCheck([spec("prd", "prd-001", "# A PRD\n")], FIXTURES_DIR);

    expect(result.unassessed).toEqual([]);
  });
});

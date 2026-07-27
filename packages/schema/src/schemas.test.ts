import { readFileSync } from "node:fs";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { describe, it, expect } from "vitest";
import { SPEC_TYPES } from "./types.js";
import baseSpecSchema from "./schemas/base-spec.json";
import prdSchema from "./schemas/prd.json";
import technicalDesignSchema from "./schemas/technical-design.json";
import userStorySchema from "./schemas/user-story.json";
import testPlanSchema from "./schemas/test-plan.json";
import adrSchema from "./schemas/adr.json";
import apiContractSchema from "./schemas/api-contract.json";
import configSchema from "./schemas/config.json";

function createAjv() {
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv, ["date"]);
  return ajv;
}

describe("base-spec schema", () => {
  const ajv = createAjv();
  const validate = ajv.compile(baseSpecSchema);

  it("accepts valid base frontmatter", () => {
    const valid = validate({
      id: "prd-001",
      type: "prd",
      title: "User Auth System",
      status: "draft",
      version: "1.0",
      created: "2026-01-15",
      updated: "2026-02-01",
      authors: ["umar"],
      tags: ["auth"],
      references: [{ id: "tech-001", relationship: "implemented-by" }],
    });
    expect(valid).toBe(true);
  });

  it("rejects missing required fields", () => {
    const valid = validate({ title: "Incomplete" });
    expect(valid).toBe(false);
    const missing = validate.errors?.map((e) => e.params.missingProperty);
    expect(missing).toContain("id");
    expect(missing).toContain("type");
    expect(missing).toContain("status");
  });

  it("rejects invalid status enum", () => {
    const valid = validate({
      id: "x",
      type: "prd",
      title: "X",
      status: "invalid",
      version: "1.0",
      created: "2026-01-01",
      authors: ["a"],
    });
    expect(valid).toBe(false);
  });

  it("accepts minimal valid frontmatter (only required fields)", () => {
    const valid = validate({
      id: "x-001",
      type: "prd",
      title: "Minimal",
      status: "draft",
      version: "1.0",
      created: "2026-01-01",
      authors: ["dev"],
    });
    expect(valid).toBe(true);
  });
});

describe("spec type schemas", () => {
  const ajv = createAjv();
  ajv.addSchema(baseSpecSchema);

  it("PRD schema validates a well-formed PRD", () => {
    const validate = ajv.compile(prdSchema);
    expect(
      validate({
        id: "prd-001",
        type: "prd",
        title: "Auth System",
        status: "approved",
        version: "1.0",
        created: "2026-01-15",
        authors: ["umar"],
      }),
    ).toBe(true);
  });

  it("PRD schema rejects wrong type field", () => {
    const validate = ajv.compile(prdSchema);
    expect(
      validate({
        id: "prd-001",
        type: "adr",
        title: "Auth System",
        status: "approved",
        version: "1.0",
        created: "2026-01-15",
        authors: ["umar"],
      }),
    ).toBe(false);
  });

  it("user-story schema requires story_id, priority, estimate", () => {
    const validate = ajv.compile(userStorySchema);
    expect(
      validate({
        id: "story-001",
        type: "user-story",
        title: "Login flow",
        status: "draft",
        version: "1.0",
        created: "2026-01-15",
        authors: ["umar"],
        story_id: "US-001",
        priority: "high",
        estimate: "3",
      }),
    ).toBe(true);
  });

  it("user-story schema rejects missing story_id", () => {
    const validate = ajv.compile(userStorySchema);
    expect(
      validate({
        id: "story-001",
        type: "user-story",
        title: "Login",
        status: "draft",
        version: "1.0",
        created: "2026-01-15",
        authors: ["umar"],
      }),
    ).toBe(false);
  });

  it("ADR schema validates a well-formed ADR", () => {
    const validate = ajv.compile(adrSchema);
    expect(
      validate({
        id: "adr-001",
        type: "adr",
        title: "Use PostgreSQL",
        status: "approved",
        version: "1.0",
        created: "2026-01-15",
        authors: ["umar"],
      }),
    ).toBe(true);
  });

  it("technical-design schema validates correctly", () => {
    const validate = ajv.compile(technicalDesignSchema);
    expect(
      validate({
        id: "tech-001",
        type: "technical-design",
        title: "Auth Architecture",
        status: "review",
        version: "1.0",
        created: "2026-01-15",
        authors: ["umar"],
      }),
    ).toBe(true);
  });

  it("test-plan schema validates correctly", () => {
    const validate = ajv.compile(testPlanSchema);
    expect(
      validate({
        id: "tp-001",
        type: "test-plan",
        title: "Auth Test Plan",
        status: "draft",
        version: "1.0",
        created: "2026-01-15",
        authors: ["umar"],
      }),
    ).toBe(true);
  });

  it("api-contract schema validates correctly", () => {
    const validate = ajv.compile(apiContractSchema);
    expect(
      validate({
        id: "api-001",
        type: "api-contract",
        title: "Auth API",
        status: "draft",
        version: "1.0",
        created: "2026-01-15",
        authors: ["umar"],
      }),
    ).toBe(true);
  });
});

describe("config schema", () => {
  const ajv = createAjv();
  const validate = ajv.compile(configSchema);

  it("accepts a valid spec.config.yaml structure", () => {
    expect(
      validate({
        version: "1.0",
        project: { name: "my-project", description: "test" },
        specs: {
          prd: { path: "specs/prd.md", type: "prd", required: true },
          stories: { path: "specs/stories/*.md", type: "user-story", requires: ["prd"] },
        },
        lint: { extends: "recommended", rules: {}, ignore: [] },
      }),
    ).toBe(true);
  });

  it("requires version field", () => {
    expect(validate({ specs: {} })).toBe(false);
  });

  it("requires specs field", () => {
    expect(validate({ version: "1.0" })).toBe(false);
  });

  it("validates spec entry structure", () => {
    expect(
      validate({ version: "1.0", specs: { prd: { path: "specs/prd.md", type: "prd" } } }),
    ).toBe(true);
  });
});

describe("spec type enum drift", () => {
  // Read the JSON from disk rather than importing it, so these assertions see
  // the files exactly as editor/schema-store consumers do — unaffected by the
  // runtime enum patching in validator.ts.
  const loadSchema = (name: string): Record<string, unknown> =>
    JSON.parse(readFileSync(new URL(`./schemas/${name}`, import.meta.url), "utf8")) as Record<
      string,
      unknown
    >;

  const enumAt = (schema: Record<string, unknown>, path: string[]): unknown => {
    let node: unknown = schema;
    for (const key of path) {
      node = (node as Record<string, unknown>)[key];
    }
    return node;
  };

  it("config.json spec type enum matches SPEC_TYPES", () => {
    const schema = loadSchema("config.json");
    expect(
      enumAt(schema, ["properties", "specs", "additionalProperties", "properties", "type", "enum"]),
    ).toEqual([...SPEC_TYPES]);
  });

  it("base-spec.json type enum matches SPEC_TYPES", () => {
    const schema = loadSchema("base-spec.json");
    expect(enumAt(schema, ["properties", "type", "enum"])).toEqual([...SPEC_TYPES]);
  });

  it("every spec type has a dedicated schema file", () => {
    for (const type of SPEC_TYPES) {
      expect(() => loadSchema(`${type}.json`)).not.toThrow();
    }
  });
});

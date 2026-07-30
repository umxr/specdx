import { describe, it, expect } from "vitest";
import { validateSpec, validateConfig } from "./validator.js";
import { SPEC_TYPES, type SpecType } from "./types.js";

describe("validateSpec", () => {
  it("validates a correct PRD frontmatter", () => {
    const result = validateSpec("prd", {
      id: "prd-001",
      type: "prd",
      title: "Auth System",
      status: "draft",
      version: "1.0",
      created: "2026-01-15",
      authors: ["umar"],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toBeNull();
  });

  it("rejects invalid frontmatter with descriptive errors", () => {
    const result = validateSpec("prd", { title: "Incomplete" });
    expect(result.valid).toBe(false);
    expect(result.errors).not.toBeNull();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it("rejects unknown spec type", () => {
    const result = validateSpec("unknown" as SpecType, {});
    expect(result.valid).toBe(false);
    expect(result.errors![0]!.message).toContain("Unknown spec type");
  });

  it("validates a valid epic spec", () => {
    const result = validateSpec("epic", {
      id: "epic-001",
      type: "epic",
      title: "User Auth Epic",
      status: "draft",
      version: "1.0",
      created: "2026-01-15",
      authors: ["umar"],
      epic_id: "EPIC-1",
      priority: "high",
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toBeNull();
  });

  it("rejects an epic missing epic_id", () => {
    const result = validateSpec("epic", {
      id: "epic-001",
      type: "epic",
      title: "User Auth Epic",
      status: "draft",
      version: "1.0",
      created: "2026-01-15",
      authors: ["umar"],
      priority: "high",
    });
    expect(result.valid).toBe(false);
    expect(result.errors).not.toBeNull();
  });

  it("validates a valid quick-spec", () => {
    const result = validateSpec("quick-spec", {
      id: "qs-001",
      type: "quick-spec",
      title: "Quick Feature Spec",
      status: "draft",
      version: "1.0",
      created: "2026-01-15",
      authors: ["umar"],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toBeNull();
  });

  it("validates a valid project-context", () => {
    const result = validateSpec("project-context", {
      id: "pc-001",
      type: "project-context",
      title: "Project Context",
      status: "draft",
      version: "1.0",
      created: "2026-01-15",
      authors: ["umar"],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toBeNull();
  });
});

describe("artifacts frontmatter (issue #15)", () => {
  const base = {
    id: "design-001",
    type: "technical-design",
    title: "Design",
    status: "draft",
    version: "1.0",
    created: "2026-07-30",
    authors: ["umar"],
  };

  it("validates a spec with well-formed artifacts", () => {
    const result = validateSpec("technical-design", {
      ...base,
      artifacts: [
        { path: "middleware.ts" },
        { path: "src/lib/bots.ts", exports: ["BOT_SIGNATURES"] },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it("rejects artifacts entries without a path", () => {
    const result = validateSpec("technical-design", {
      ...base,
      artifacts: [{ exports: ["x"] }],
    });
    expect(result.valid).toBe(false);
  });

  it("rejects artifacts entries with unknown keys", () => {
    const result = validateSpec("technical-design", {
      ...base,
      artifacts: [{ path: "a.ts", symbol: "x" }],
    });
    expect(result.valid).toBe(false);
  });
});

describe("validateConfig", () => {
  it("validates a correct config", () => {
    const result = validateConfig({
      version: "1.0",
      specs: { prd: { path: "specs/prd.md", type: "prd" } },
    });
    expect(result.valid).toBe(true);
  });

  it("rejects config missing version", () => {
    const result = validateConfig({ specs: {} });
    expect(result.valid).toBe(false);
  });

  it("accepts every spec type in SPEC_TYPES", () => {
    for (const type of SPEC_TYPES) {
      const result = validateConfig({
        version: "1.0",
        specs: { [type]: { path: `specs/${type}.md`, type } },
      });
      expect(result.valid, `config with spec type "${type}" should be valid`).toBe(true);
    }
  });

  it("accepts valid pack config with all fields", () => {
    const result = validateConfig({
      version: "1.0",
      specs: { prd: { path: "specs/prd.md", type: "prd" } },
      pack: {
        max_tokens: 100000,
        format: "xml",
        compression: {
          strip_boilerplate: true,
          stable_days: 30,
          collapse_resolved_adrs: true,
        },
        boilerplate_sections: ["changelog", "license"],
      },
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toBeNull();
  });

  it("rejects invalid pack format value", () => {
    const result = validateConfig({
      version: "1.0",
      specs: { prd: { path: "specs/prd.md", type: "prd" } },
      pack: {
        format: "yaml",
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).not.toBeNull();
  });

  it("rejects negative max_tokens in pack config", () => {
    const result = validateConfig({
      version: "1.0",
      specs: { prd: { path: "specs/prd.md", type: "prd" } },
      pack: {
        max_tokens: -1,
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).not.toBeNull();
  });

  it("rejects zero max_tokens in pack config", () => {
    const result = validateConfig({
      version: "1.0",
      specs: { prd: { path: "specs/prd.md", type: "prd" } },
      pack: {
        max_tokens: 0,
      },
    });
    expect(result.valid).toBe(false);
    expect(result.errors).not.toBeNull();
  });
});

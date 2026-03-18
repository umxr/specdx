import { describe, it, expect } from "vitest";
import { validateSpec, validateConfig } from "./validator.js";

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
    const result = validateSpec("unknown" as any, {});
    expect(result.valid).toBe(false);
    expect(result.errors![0]!.message).toContain("Unknown spec type");
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
});

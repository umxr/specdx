import { describe, it, expect } from "vitest";
import { generateUpdates } from "./update.js";

describe("generateUpdates", () => {
  it("generates suggestions for extra routes found in code", () => {
    const result = generateUpdates({
      findings: [
        {
          type: "extra",
          category: "route",
          specId: "api-001",
          expected: "(not in spec)",
          actual: "POST /api/users",
          severity: "info",
        },
        {
          type: "extra",
          category: "route",
          specId: "api-001",
          expected: "(not in spec)",
          actual: "DELETE /api/users/:id",
          severity: "info",
        },
      ],
    });

    expect(result.suggestions).toHaveLength(2);
    expect(result.suggestions[0]!.specId).toBe("api-001");
    expect(result.suggestions[0]!.addition).toContain("POST /api/users");
    expect(result.suggestions[0]!.section).toBe("Endpoints");
  });

  it("generates suggestions for extra types found in code", () => {
    const result = generateUpdates({
      findings: [
        {
          type: "extra",
          category: "type",
          specId: "tech-001",
          expected: "(not in spec)",
          actual: "Field Post.publishedAt (Date)",
          severity: "info",
        },
      ],
    });

    expect(result.suggestions).toHaveLength(1);
    expect(result.suggestions[0]!.section).toBe("Data Model");
  });

  it("returns empty for no actionable findings", () => {
    const result = generateUpdates({ findings: [] });
    expect(result.suggestions).toHaveLength(0);
  });

  it("ignores missing findings (those are code issues, not spec updates)", () => {
    const result = generateUpdates({
      findings: [
        {
          type: "missing",
          category: "route",
          specId: "api-001",
          expected: "GET /api/users/:id",
          severity: "error",
        },
      ],
    });
    expect(result.suggestions).toHaveLength(0);
  });
});

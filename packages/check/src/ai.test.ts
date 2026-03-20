import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Finding } from "./types.js";

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify([
              {
                findingIndex: 0,
                isRealIssue: true,
                confidence: "high",
                reasoning: "Route is missing",
                suggestedFix: "Add GET /api/users/:id handler",
              },
              {
                findingIndex: 1,
                isRealIssue: false,
                confidence: "medium",
                reasoning: "Extra route is intentional",
              },
            ]),
          },
        ],
      }),
    };
  },
}));

describe("analyzeWithAi", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("sends findings to Anthropic and returns assessments", async () => {
    process.env["ANTHROPIC_API_KEY"] = "test-key";

    const { analyzeWithAi } = await import("./ai.js");

    const findings: Finding[] = [
      {
        type: "missing",
        category: "route",
        specId: "api",
        expected: "GET /api/users/:id",
        severity: "error",
      },
      {
        type: "extra",
        category: "route",
        specId: "api",
        expected: "(not in spec)",
        actual: "PATCH /api/users/:id",
        severity: "info",
      },
    ];

    const result = await analyzeWithAi(findings, "Check API routes");
    expect(result.assessments).toHaveLength(2);
    expect(result.assessments[0]!.isRealIssue).toBe(true);
    expect(result.assessments[1]!.isRealIssue).toBe(false);
    expect(result.summary).toContain("1 real issues");

    delete process.env["ANTHROPIC_API_KEY"];
  });

  it("throws when ANTHROPIC_API_KEY is not set", async () => {
    delete process.env["ANTHROPIC_API_KEY"];

    const { analyzeWithAi } = await import("./ai.js");

    await expect(analyzeWithAi([], "test")).rejects.toThrow("ANTHROPIC_API_KEY");
  });

  it("returns empty assessments for empty findings", async () => {
    process.env["ANTHROPIC_API_KEY"] = "test-key";

    const { analyzeWithAi } = await import("./ai.js");
    const result = await analyzeWithAi([], "test");
    expect(result.assessments).toHaveLength(0);
    expect(result.summary).toContain("No findings");

    delete process.env["ANTHROPIC_API_KEY"];
  });
});

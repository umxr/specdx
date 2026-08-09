import { describe, it, expect } from "vitest";

describe("check command", () => {
  it("exports a citty command", async () => {
    const mod = await import("./check.js");
    expect(mod.default).toBeDefined();
    expect((mod.default.meta as { name: string })?.name).toBe("check");
  });
});

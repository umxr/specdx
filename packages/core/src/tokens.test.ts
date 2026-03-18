import { describe, it, expect } from "vitest";
import { countTokens } from "./tokens.js";

describe("countTokens", () => {
  it("counts tokens for a simple string", () => {
    const count = countTokens("Hello, world!");
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(10);
  });

  it("returns 0 for empty string", () => {
    expect(countTokens("")).toBe(0);
  });

  it("counts within ±10% of expected for longer text", () => {
    const count = countTokens("The quick brown fox jumps over the lazy dog");
    expect(count).toBeGreaterThanOrEqual(8);
    expect(count).toBeLessThanOrEqual(12);
  });
});

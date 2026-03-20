import { describe, it, expect } from "vitest";
import { extractTestDescriptions } from "./test-extractor.js";
import { join } from "node:path";

describe("extractTestDescriptions", () => {
  const fixtureDir = join(import.meta.dirname, "../../test/fixtures");

  it("extracts it() and describe() descriptions from test files", async () => {
    const tests = await extractTestDescriptions(fixtureDir, ".");
    expect(tests.length).toBeGreaterThanOrEqual(5);
    const descriptions = tests.map((t) => t.description);
    expect(descriptions).toContain("should create a new user");
    expect(descriptions).toContain("should reject invalid email");
  });

  it("returns empty for a nonexistent directory", async () => {
    const tests = await extractTestDescriptions(fixtureDir, "nonexistent");
    expect(tests).toEqual([]);
  });

  it("includes file and line number in each result", async () => {
    const tests = await extractTestDescriptions(fixtureDir, ".");
    for (const t of tests) {
      expect(typeof t.file).toBe("string");
      expect(t.file.length).toBeGreaterThan(0);
      expect(typeof t.line).toBe("number");
      expect(t.line).toBeGreaterThan(0);
    }
  });
});

import { describe, it, expect } from "vitest";
import { resolveGlob } from "./glob.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../test/fixtures");

describe("resolveGlob", () => {
  it("resolves a specific file path", async () => {
    const files = await resolveGlob("specs/prd.md", fixturesDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain("prd.md");
  });

  it("resolves glob patterns", async () => {
    const files = await resolveGlob("specs/*.md", fixturesDir);
    expect(files.length).toBeGreaterThan(0);
  });

  it("returns empty array for no matches", async () => {
    const files = await resolveGlob("nonexistent/*.xyz", fixturesDir);
    expect(files).toEqual([]);
  });
});

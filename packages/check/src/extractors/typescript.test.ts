import { describe, it, expect } from "vitest";
import { extractTypeScriptTypes } from "./typescript.js";
import { join } from "node:path";

describe("extractTypeScriptTypes", () => {
  const fixtureDir = join(import.meta.dirname, "../../test/fixtures");

  it("extracts interfaces with fields", async () => {
    const types = await extractTypeScriptTypes(fixtureDir, ".");
    const user = types.find((t) => t.name === "User");
    expect(user).toBeDefined();
    expect(user!.fields).toHaveLength(5);
    expect(user!.fields[0]).toEqual({ name: "id", type: "string", optional: false });
  });

  it("detects optional fields", async () => {
    const types = await extractTypeScriptTypes(fixtureDir, ".");
    const post = types.find((t) => t.name === "Post");
    expect(post).toBeDefined();
    const publishedAt = post!.fields.find((f) => f.name === "publishedAt");
    expect(publishedAt?.optional).toBe(true);
  });

  it("returns empty for nonexistent directory", async () => {
    const types = await extractTypeScriptTypes(fixtureDir, "nonexistent");
    expect(types).toEqual([]);
  });
});

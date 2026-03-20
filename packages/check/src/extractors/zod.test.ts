import { describe, it, expect } from "vitest";
import { extractZodSchemas } from "./zod.js";
import { join } from "node:path";

describe("extractZodSchemas", () => {
  const fixtureDir = join(import.meta.dirname, "../../test/fixtures");

  it("extracts Zod object schemas", async () => {
    const types = await extractZodSchemas(fixtureDir, ".");
    const user = types.find((t) => t.name === "User");
    expect(user).toBeDefined();
    expect(user!.fields).toHaveLength(5);
    expect(user!.fields.find((f) => f.name === "role")?.type).toBe('"admin" | "user"');
  });

  it("detects optional fields", async () => {
    const types = await extractZodSchemas(fixtureDir, ".");
    const post = types.find((t) => t.name === "Post");
    const publishedAt = post?.fields.find((f) => f.name === "publishedAt");
    expect(publishedAt?.optional).toBe(true);
  });

  it("returns empty for nonexistent directory", async () => {
    const types = await extractZodSchemas(fixtureDir, "nonexistent");
    expect(types).toEqual([]);
  });
});

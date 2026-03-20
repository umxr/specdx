import { describe, it, expect } from "vitest";
import { extractPrismaModels } from "./prisma.js";
import { join } from "node:path";

describe("extractPrismaModels", () => {
  const fixtureDir = join(import.meta.dirname, "../../test/fixtures");

  it("extracts models from schema.prisma", async () => {
    const types = await extractPrismaModels(fixtureDir);
    expect(types).toHaveLength(2);
    const user = types.find((t) => t.name === "User");
    expect(user).toBeDefined();
    expect(user!.fields.find((f) => f.name === "id")?.type).toBe("string");
  });

  it("maps Prisma types to TS equivalents", async () => {
    const types = await extractPrismaModels(fixtureDir);
    const user = types.find((t) => t.name === "User");
    expect(user!.fields.find((f) => f.name === "createdAt")?.type).toBe("Date");
  });

  it("detects optional fields", async () => {
    const types = await extractPrismaModels(fixtureDir);
    const post = types.find((t) => t.name === "Post");
    expect(post!.fields.find((f) => f.name === "publishedAt")?.optional).toBe(true);
  });

  it("skips relation fields", async () => {
    const types = await extractPrismaModels(fixtureDir);
    const post = types.find((t) => t.name === "Post");
    expect(post!.fields.find((f) => f.name === "author")).toBeUndefined();
    const user = types.find((t) => t.name === "User");
    expect(user!.fields.find((f) => f.name === "posts")).toBeUndefined();
  });
});

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

describe("extractPrismaModels — schema location", () => {
  const at = (name: string) => join(import.meta.dirname, "../../test/fixtures", name);

  // Only the project root was read, and `prisma init` writes prisma/schema.prisma.
  // So a real Prisma project's models were invisible, every one of them was
  // reported unimplemented, and the coverage score dropped to match.
  it("reads prisma/schema.prisma, the layout `prisma init` creates", async () => {
    const types = await extractPrismaModels(at("prisma-project"));
    expect(types.map((t) => t.name)).toEqual(["Order"]);
    expect(types[0]!.fields.find((f) => f.name === "totalCents")?.type).toBe("number");
  });

  it("reads the multi-file prisma/schema/ directory", async () => {
    const types = await extractPrismaModels(at("prisma-folder"));
    expect(types.map((t) => t.name).sort()).toEqual(["Order", "Shipment"]);
  });

  it("still reads a schema at the project root", async () => {
    const types = await extractPrismaModels(join(import.meta.dirname, "../../test/fixtures"));
    expect(types.map((t) => t.name).sort()).toEqual(["Post", "User"]);
  });

  it("returns nothing when there is no schema anywhere", async () => {
    expect(await extractPrismaModels(at("nextjs-app"))).toEqual([]);
  });
});

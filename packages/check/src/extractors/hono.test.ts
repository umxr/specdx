import { describe, it, expect } from "vitest";
import { extractHonoRoutes } from "./hono.js";
import { join } from "node:path";

describe("extractHonoRoutes", () => {
  const fixtureDir = join(import.meta.dirname, "../../test/fixtures");

  it("extracts routes from Hono app with route() prefix", async () => {
    const routes = await extractHonoRoutes(fixtureDir, ".");
    expect(routes.length).toBeGreaterThanOrEqual(4);

    const getPaths = routes.filter((r) => r.method === "GET").map((r) => r.path);
    expect(getPaths).toContain("/api/users");
    expect(getPaths).toContain("/api/users/:id");
  });

  it("extracts path params", async () => {
    const routes = await extractHonoRoutes(fixtureDir, ".");
    const userById = routes.find((r) => r.path === "/api/users/:id" && r.method === "GET");
    expect(userById).toBeDefined();
    expect(userById!.params).toContain("id");
  });

  it("returns empty for dir with no routes", async () => {
    const routes = await extractHonoRoutes(fixtureDir, "nonexistent");
    expect(routes).toEqual([]);
  });
});

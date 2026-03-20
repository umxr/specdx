import { describe, it, expect } from "vitest";
import { extractExpressRoutes } from "./express.js";
import { join } from "node:path";

describe("extractExpressRoutes", () => {
  const fixtureDir = join(import.meta.dirname, "../../test/fixtures");

  it("extracts routes from Express app", async () => {
    const routes = await extractExpressRoutes(fixtureDir, ".");
    expect(routes.length).toBeGreaterThanOrEqual(5);

    const getPaths = routes.filter((r) => r.method === "GET").map((r) => r.path);
    expect(getPaths).toContain("/api/users");
    expect(getPaths).toContain("/api/users/:id");
  });

  it("extracts path params", async () => {
    const routes = await extractExpressRoutes(fixtureDir, ".");
    const userById = routes.find((r) => r.path === "/api/users/:id" && r.method === "GET");
    expect(userById).toBeDefined();
    expect(userById!.params).toContain("id");
  });

  it("returns empty for dir with no routes", async () => {
    const routes = await extractExpressRoutes(fixtureDir, "nonexistent");
    expect(routes).toEqual([]);
  });
});

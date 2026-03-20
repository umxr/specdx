import { describe, it, expect } from "vitest";
import { extractNextjsRoutes } from "./nextjs.js";
import { join } from "node:path";

describe("extractNextjsRoutes", () => {
  const fixtureDir = join(import.meta.dirname, "../../test/fixtures");

  it("extracts routes from Next.js App Router directory", async () => {
    const routes = await extractNextjsRoutes(fixtureDir, "nextjs-app");
    expect(routes.length).toBeGreaterThanOrEqual(5);

    expect(routes).toContainEqual(
      expect.objectContaining({ method: "GET", path: "/api/users" }),
    );
    expect(routes).toContainEqual(
      expect.objectContaining({ method: "POST", path: "/api/users" }),
    );
    expect(routes).toContainEqual(
      expect.objectContaining({ method: "GET", path: "/api/users/:id", params: ["id"] }),
    );
  });

  it("maps dynamic segments to params", async () => {
    const routes = await extractNextjsRoutes(fixtureDir, "nextjs-app");
    const dynamic = routes.find((r) => r.path.includes(":id"));
    expect(dynamic).toBeDefined();
    expect(dynamic!.params).toContain("id");
  });

  it("returns empty for nonexistent directory", async () => {
    const routes = await extractNextjsRoutes(fixtureDir, "nonexistent-app");
    expect(routes).toEqual([]);
  });
});

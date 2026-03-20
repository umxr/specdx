import { describe, it, expect } from "vitest";
import { matchRoutes } from "./routes.js";
import type { SpecEndpoint, ExtractedRoute } from "../types.js";

describe("matchRoutes", () => {
  const specEndpoints: SpecEndpoint[] = [
    { method: "GET", path: "/api/users", params: [] },
    { method: "POST", path: "/api/users", params: [] },
    { method: "GET", path: "/api/users/:id", params: ["id"] },
    { method: "DELETE", path: "/api/users/:id", params: ["id"] },
  ];

  const codeRoutes: ExtractedRoute[] = [
    { method: "GET", path: "/api/users", params: [], file: "routes.ts", line: 1 },
    { method: "POST", path: "/api/users", params: [], file: "routes.ts", line: 5 },
    { method: "GET", path: "/api/users/:id", params: ["id"], file: "routes.ts", line: 9 },
    { method: "PATCH", path: "/api/users/:id", params: ["id"], file: "routes.ts", line: 13 },
  ];

  it("finds missing routes (in spec but not code)", () => {
    const findings = matchRoutes(specEndpoints, codeRoutes, "api-contract");
    const missing = findings.filter((f) => f.type === "missing");
    expect(missing).toHaveLength(1);
    expect(missing[0]!.expected).toContain("DELETE /api/users/:id");
  });

  it("finds extra routes (in code but not spec)", () => {
    const findings = matchRoutes(specEndpoints, codeRoutes, "api-contract");
    const extra = findings.filter((f) => f.type === "extra");
    expect(extra).toHaveLength(1);
    expect(extra[0]!.actual).toContain("PATCH /api/users/:id");
  });

  it("marks missing as error and extra as info", () => {
    const findings = matchRoutes(specEndpoints, codeRoutes, "api-contract");
    expect(findings.find((f) => f.type === "missing")?.severity).toBe("error");
    expect(findings.find((f) => f.type === "extra")?.severity).toBe("info");
  });

  it("returns empty findings when everything matches", () => {
    const findings = matchRoutes(
      specEndpoints,
      specEndpoints.map((e) => ({ ...e, file: "routes.ts", line: 1 })),
      "api-contract",
    );
    expect(findings).toHaveLength(0);
  });
});

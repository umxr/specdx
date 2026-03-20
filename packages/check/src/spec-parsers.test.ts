import { describe, it, expect } from "vitest";
import { parseEndpoints, parseTypeDefinitions, parseTestCases } from "./spec-parsers.js";

describe("parseEndpoints", () => {
  it("extracts endpoints from Endpoints section", () => {
    const content = `## Endpoints

### GET /api/users
Returns a list of users.

### POST /api/users
Creates a new user.
- Body: \`{ name: string, email: string }\`

### GET /api/users/:id
Returns a single user by ID.

### DELETE /api/users/:id
Deletes a user.
`;
    const result = parseEndpoints(content);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ method: "GET", path: "/api/users", params: [], description: "Returns a list of users." });
    expect(result[2]).toEqual({ method: "GET", path: "/api/users/:id", params: ["id"], description: "Returns a single user by ID." });
  });

  it("returns empty array when no Endpoints section", () => {
    const content = `## Overview\n\nSome content.`;
    expect(parseEndpoints(content)).toEqual([]);
  });
});

describe("parseTypeDefinitions", () => {
  it("extracts types from Data Model section", () => {
    const content = `## Data Model

### User
- \`id\`: string (UUID)
- \`name\`: string
- \`email\`: string
- \`role\`: "admin" | "user"
- \`createdAt\`: Date

### Post
- \`id\`: string
- \`title\`: string
- \`content\`: string
- \`authorId\`: string
- \`publishedAt?\`: Date
`;
    const result = parseTypeDefinitions(content);
    expect(result).toHaveLength(2);
    expect(result[0]!.name).toBe("User");
    expect(result[0]!.fields).toHaveLength(5);
    expect(result[0]!.fields[0]).toEqual({ name: "id", type: "string", optional: false });
    expect(result[1]!.fields[4]).toEqual({ name: "publishedAt", type: "Date", optional: true });
  });

  it("returns empty array when no Data Model section", () => {
    expect(parseTypeDefinitions("## Architecture\n\nContent.")).toEqual([]);
  });
});

describe("parseTestCases", () => {
  it("extracts test cases from Test Cases section", () => {
    const content = `## Test Cases

### @specdx/core
- Config loader: finds config, handles missing config, validates structure
- Spec parser: parses markdown frontmatter, extracts H2 sections

### @specdx/lint
- Engine: loads rules, runs against specs, collects diagnostics
`;
    const result = parseTestCases(content);
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result[0]!.description).toContain("Config loader");
  });

  it("returns empty array when no Test Cases section", () => {
    expect(parseTestCases("## Scope\n\nContent.")).toEqual([]);
  });
});

# Phase 4 Slice 1 — `@specdx/check` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `sdx check` — static spec-to-implementation analysis that detects drift between specs and code using AST parsing and pattern matching. No LLM calls.

**Architecture:** New `@specdx/check` package with framework-specific route extractors, type/schema matchers, test coverage mapper, and a completeness scorer. CLI command delegates to the package. `ts-morph` is lazy-loaded to keep the base CLI lightweight.

**Tech Stack:** TypeScript (ESM only), ts-morph (AST parsing), Vitest, citty (CLI)

**Design spec:** `specs/designs/2026-03-20-phase-4-spec-intelligence-design.md` (Slice 1 section)

---

## File Structure

```
packages/check/                           # NEW PACKAGE
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── index.ts                          # public exports
    ├── types.ts                          # CheckResult, Finding, ExtractedRoute, etc.
    ├── check.ts                          # orchestrator: loads specs, runs matchers, scores
    ├── spec-parsers.ts                   # parse endpoint/type/test sections from specs
    ├── extractors/
    │   ├── types.ts                      # shared extractor types
    │   ├── express.ts                    # Express route extractor
    │   ├── hono.ts                       # Hono route extractor
    │   ├── nextjs.ts                     # Next.js App Router extractor
    │   ├── typescript.ts                 # TS interface/type extractor
    │   ├── zod.ts                        # Zod schema extractor
    │   └── prisma.ts                     # Prisma model extractor (regex, no ts-morph)
    ├── matchers/
    │   ├── routes.ts                     # API contract ↔ route comparison
    │   ├── types.ts                      # Data model ↔ type comparison
    │   └── tests.ts                      # Test plan ↔ test file comparison
    ├── score.ts                          # Implementation completeness score
    ├── spec-parsers.test.ts
    ├── extractors/
    │   ├── express.test.ts
    │   ├── hono.test.ts
    │   ├── nextjs.test.ts
    │   ├── typescript.test.ts
    │   ├── zod.test.ts
    │   └── prisma.test.ts
    ├── matchers/
    │   ├── routes.test.ts
    │   ├── types.test.ts
    │   └── tests.test.ts
    ├── score.test.ts
    └── check.test.ts

packages/check/test/fixtures/            # test fixture files
├── express-app.ts
├── hono-app.ts
├── nextjs-app/
│   └── api/users/route.ts
│   └── api/users/[id]/route.ts
├── types.ts
├── zod-schemas.ts
├── schema.prisma
└── sample.test.ts

packages/schema/src/types.ts              # MODIFY: add CheckConfig to SdxConfig
packages/schema/src/schemas/config.json   # MODIFY: add check block to JSON schema
packages/cli/src/commands/check.ts        # CREATE: sdx check command
packages/cli/src/commands/check.test.ts   # CREATE: CLI integration test
packages/cli/src/main.ts                  # MODIFY: register check command
packages/cli/tsup.config.ts              # MODIFY: add @specdx/check to noExternal
```

---

## Task 1: Package Scaffolding

**Files:**
- Create: `packages/check/package.json`
- Create: `packages/check/tsconfig.json`
- Create: `packages/check/vitest.config.ts`
- Create: `packages/check/src/index.ts`
- Create: `packages/check/src/types.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "@specdx/check",
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc --build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist *.tsbuildinfo"
  },
  "dependencies": {
    "@specdx/schema": "workspace:*",
    "@specdx/core": "workspace:*"
  },
  "peerDependencies": {
    "ts-morph": ">=24.0.0"
  },
  "peerDependenciesMeta": {
    "ts-morph": {
      "optional": true
    }
  },
  "devDependencies": {
    "ts-morph": "^24.0.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "dist",
    "typeRoots": ["../../node_modules/@types"]
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"],
  "references": [
    { "path": "../schema" },
    { "path": "../core" }
  ]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { mergeConfig } from "vitest/config";
import shared from "../../vitest.shared.js";

export default mergeConfig(shared, {});
```

- [ ] **Step 4: Create src/types.ts**

```typescript
export interface CheckResult {
  findings: Finding[];
  score: ImplementationScore;
  summary: string;
}

export interface Finding {
  type: "missing" | "extra" | "mismatch" | "drift";
  category: "route" | "type" | "test";
  specId: string;
  specSection?: string;
  codeLocation?: { file: string; line: number };
  expected: string;
  actual?: string;
  severity: "error" | "warn" | "info";
  suggestion?: string;
}

export interface ImplementationScore {
  overall: number;
  byCategory: Record<string, { matched: number; total: number }>;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ExtractedRoute {
  method: HttpMethod;
  path: string;
  params: string[];
  file: string;
  line: number;
}

export interface ExtractedType {
  name: string;
  fields: { name: string; type: string; optional: boolean }[];
  file: string;
  line: number;
}

export interface ExtractedTest {
  description: string;
  file: string;
  line: number;
}

export interface SpecEndpoint {
  method: HttpMethod;
  path: string;
  params: string[];
  description?: string;
}

export interface SpecTypeDefinition {
  name: string;
  fields: { name: string; type: string; optional: boolean }[];
}

export interface SpecTestCase {
  description: string;
  section?: string;
}

export interface CheckConfig {
  framework?: "auto" | "express" | "hono" | "nextjs";
  routes_dir?: string;
  app_dir?: string;
  types_dir?: string;
  tests_dir?: string;
  ignore?: string[];
}
```

- [ ] **Step 5: Create src/index.ts (empty exports for now)**

```typescript
export type {
  CheckResult,
  Finding,
  ImplementationScore,
  HttpMethod,
  ExtractedRoute,
  ExtractedType,
  ExtractedTest,
  SpecEndpoint,
  SpecTypeDefinition,
  SpecTestCase,
  CheckConfig,
} from "./types.js";
```

- [ ] **Step 6: Install dependencies and verify build**

```bash
cd packages/check && pnpm install
pnpm build
```

- [ ] **Step 7: Commit**

```bash
git add packages/check/
git commit -m "feat(check): scaffold @specdx/check package with types"
```

---

## Task 2: Spec Section Parsers

Parse spec content to extract endpoints, type definitions, and test cases from markdown sections.

**Files:**
- Create: `packages/check/src/spec-parsers.ts`
- Create: `packages/check/src/spec-parsers.test.ts`

- [ ] **Step 1: Write failing tests for spec parsers**

```typescript
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
    expect(result.length).toBeGreaterThanOrEqual(4);
    expect(result[0]!.description).toContain("Config loader");
  });

  it("returns empty array when no Test Cases section", () => {
    expect(parseTestCases("## Scope\n\nContent.")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter @specdx/check test
```
Expected: FAIL — functions not defined.

- [ ] **Step 3: Implement spec parsers**

```typescript
import type { SpecEndpoint, SpecTypeDefinition, SpecTestCase, HttpMethod } from "./types.js";

const ENDPOINT_RE = /^###\s+(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/gm;
const FIELD_RE = /^-\s+`(\w+\??)`:\s+(.+)$/gm;

function extractSection(content: string, heading: string): string | null {
  const re = new RegExp(`^## ${heading}\\b[^\\n]*\\n([\\s\\S]*?)(?=^## |$)`, "m");
  const match = re.exec(content);
  return match ? match[1]!.trim() : null;
}

export function parseEndpoints(content: string): SpecEndpoint[] {
  const section = extractSection(content, "Endpoints");
  if (!section) return [];

  const endpoints: SpecEndpoint[] = [];
  const parts = section.split(/^###\s+/m).filter(Boolean);

  for (const part of parts) {
    const firstLine = part.split("\n")[0]!.trim();
    const match = /^(GET|POST|PUT|PATCH|DELETE)\s+(.+)$/.exec(firstLine);
    if (!match) continue;

    const method = match[1] as HttpMethod;
    const path = match[2]!.trim();
    const params = [...path.matchAll(/:(\w+)/g)].map((m) => m[1]!);
    const rest = part.split("\n").slice(1).join("\n").trim();
    const description = rest.split("\n")[0]?.replace(/^-\s+.*$/, "").trim() || undefined;

    endpoints.push({ method, path, params, description: description || undefined });
  }

  return endpoints;
}

export function parseTypeDefinitions(content: string): SpecTypeDefinition[] {
  const section = extractSection(content, "Data Model");
  if (!section) return [];

  const types: SpecTypeDefinition[] = [];
  const parts = section.split(/^###\s+/m).filter(Boolean);

  for (const part of parts) {
    const name = part.split("\n")[0]!.trim();
    if (!name) continue;

    const fields: SpecTypeDefinition["fields"] = [];
    const lines = part.split("\n").slice(1);

    for (const line of lines) {
      const match = /^-\s+`(\w+?)(\?)?`:\s+(.+)$/.exec(line.trim());
      if (match) {
        fields.push({
          name: match[1]!,
          type: match[3]!.replace(/\s*\(.*\)$/, "").trim(),
          optional: match[2] === "?",
        });
      }
    }

    if (fields.length > 0) {
      types.push({ name, fields });
    }
  }

  return types;
}

export function parseTestCases(content: string): SpecTestCase[] {
  const section = extractSection(content, "Test Cases");
  if (!section) return [];

  const cases: SpecTestCase[] = [];
  let currentSection: string | undefined;

  for (const line of section.split("\n")) {
    const headingMatch = /^###\s+(.+)$/.exec(line);
    if (headingMatch) {
      currentSection = headingMatch[1]!.trim();
      continue;
    }
    const itemMatch = /^-\s+(.+)$/.exec(line.trim());
    if (itemMatch) {
      cases.push({ description: itemMatch[1]!.trim(), section: currentSection });
    }
  }

  return cases;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter @specdx/check test
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/check/src/spec-parsers.ts packages/check/src/spec-parsers.test.ts
git commit -m "feat(check): add spec section parsers for endpoints, types, test cases"
```

---

## Task 3: Express Route Extractor

**Files:**
- Create: `packages/check/src/extractors/types.ts`
- Create: `packages/check/src/extractors/express.ts`
- Create: `packages/check/src/extractors/express.test.ts`
- Create: `packages/check/test/fixtures/express-app.ts`

- [ ] **Step 1: Create shared extractor types**

`packages/check/src/extractors/types.ts`:
```typescript
import type { ExtractedRoute, ExtractedType, ExtractedTest } from "../types.js";

export interface RouteExtractor {
  extract(projectDir: string, routesDir?: string): Promise<ExtractedRoute[]>;
}

export type { ExtractedRoute, ExtractedType, ExtractedTest };
```

- [ ] **Step 2: Create Express fixture**

`packages/check/test/fixtures/express-app.ts`:
```typescript
import express from "express";

const app = express();
const router = express.Router();

router.get("/users", (_req, res) => {
  res.json([]);
});

router.post("/users", (_req, res) => {
  res.status(201).json({});
});

router.get("/users/:id", (req, res) => {
  res.json({ id: req.params.id });
});

router.delete("/users/:id", (req, res) => {
  res.status(204).send();
});

router.put("/users/:id/profile", (req, res) => {
  res.json({});
});

app.use("/api", router);

export default app;
```

- [ ] **Step 3: Write failing test for Express extractor**

```typescript
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
```

- [ ] **Step 4: Run test to verify it fails**

```bash
pnpm --filter @specdx/check test
```
Expected: FAIL

- [ ] **Step 5: Implement Express extractor**

`packages/check/src/extractors/express.ts`:
```typescript
import type { ExtractedRoute, HttpMethod } from "../types.js";
import { join } from "node:path";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

export async function extractExpressRoutes(
  projectDir: string,
  routesDir?: string,
): Promise<ExtractedRoute[]> {
  let tsMorph: typeof import("ts-morph");
  try {
    tsMorph = await import("ts-morph");
  } catch {
    throw new Error("ts-morph is required for route extraction. Install it: pnpm add -D ts-morph");
  }

  const scanDir = routesDir ? join(projectDir, routesDir) : projectDir;
  const project = new tsMorph.Project({ skipAddingFilesFromTsConfig: true });

  // Add all TS/JS files in the scan directory
  project.addSourceFilesAtPaths([
    join(scanDir, "**/*.ts"),
    join(scanDir, "**/*.js"),
    "!" + join(scanDir, "**/*.test.*"),
    "!" + join(scanDir, "**/*.spec.*"),
    "!" + join(scanDir, "**/node_modules/**"),
  ]);

  const routes: ExtractedRoute[] = [];
  const mountPrefixes = new Map<string, string>(); // variable name → prefix

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();

    // Find app.use("/prefix", router) to track mount prefixes
    for (const call of sourceFile.getDescendantsOfKind(tsMorph.SyntaxKind.CallExpression)) {
      const expr = call.getExpression();
      if (!tsMorph.Node.isPropertyAccessExpression(expr)) continue;
      if (expr.getName() !== "use") continue;

      const args = call.getArguments();
      if (args.length >= 2) {
        const first = args[0];
        const second = args[1];
        if (
          first &&
          second &&
          tsMorph.Node.isStringLiteral(first) &&
          tsMorph.Node.isIdentifier(second)
        ) {
          mountPrefixes.set(second.getText(), first.getLiteralValue());
        }
      }
    }

    // Find router.get("/path", handler) and app.get("/path", handler) calls
    for (const call of sourceFile.getDescendantsOfKind(tsMorph.SyntaxKind.CallExpression)) {
      const expr = call.getExpression();
      if (!tsMorph.Node.isPropertyAccessExpression(expr)) continue;

      const methodName = expr.getName().toLowerCase();
      if (!(HTTP_METHODS as readonly string[]).includes(methodName)) continue;

      const args = call.getArguments();
      if (args.length === 0) continue;

      const firstArg = args[0]!;
      if (!tsMorph.Node.isStringLiteral(firstArg)) continue;

      let path = firstArg.getLiteralValue();

      // Check if the receiver is a known router with a mount prefix
      const receiver = expr.getExpression();
      if (tsMorph.Node.isIdentifier(receiver)) {
        const prefix = mountPrefixes.get(receiver.getText());
        if (prefix) {
          path = prefix.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
        }
      }

      // Normalise path
      path = "/" + path.replace(/^\/+/, "").replace(/\/+$/, "");

      const params = [...path.matchAll(/:(\w+)/g)].map((m) => m[1]!);

      routes.push({
        method: methodName.toUpperCase() as HttpMethod,
        path,
        params,
        file: filePath,
        line: call.getStartLineNumber(),
      });
    }
  }

  return routes;
}
```

- [ ] **Step 6: Run test to verify it passes**

```bash
pnpm --filter @specdx/check test
```
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/check/src/extractors/ packages/check/test/
git commit -m "feat(check): add Express route extractor with ts-morph AST parsing"
```

---

## Task 4: Hono Route Extractor

**Files:**
- Create: `packages/check/src/extractors/hono.ts`
- Create: `packages/check/src/extractors/hono.test.ts`
- Create: `packages/check/test/fixtures/hono-app.ts`

- [ ] **Step 1: Create Hono fixture**

`packages/check/test/fixtures/hono-app.ts`:
```typescript
import { Hono } from "hono";

const app = new Hono();
const users = new Hono();

users.get("/", (c) => c.json([]));
users.post("/", (c) => c.json({}, 201));
users.get("/:id", (c) => c.json({ id: c.req.param("id") }));
users.delete("/:id", (c) => c.body(null, 204));

app.route("/api/users", users);

export default app;
```

- [ ] **Step 2: Write failing test**

```typescript
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
});
```

- [ ] **Step 3: Run test to verify it fails**

- [ ] **Step 4: Implement Hono extractor**

Hono uses the same `app.get("/path", handler)` pattern as Express, plus `app.route("/prefix", subApp)` for mounting. The implementation is structurally identical to the Express extractor — same AST walk for HTTP method calls, same mount prefix tracking but looking for `.route()` instead of `.use()`.

`packages/check/src/extractors/hono.ts`:
```typescript
import type { ExtractedRoute, HttpMethod } from "../types.js";
import { join } from "node:path";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

export async function extractHonoRoutes(
  projectDir: string,
  routesDir?: string,
): Promise<ExtractedRoute[]> {
  let tsMorph: typeof import("ts-morph");
  try {
    tsMorph = await import("ts-morph");
  } catch {
    throw new Error("ts-morph is required for route extraction. Install it: pnpm add -D ts-morph");
  }

  const scanDir = routesDir ? join(projectDir, routesDir) : projectDir;
  const project = new tsMorph.Project({ skipAddingFilesFromTsConfig: true });

  project.addSourceFilesAtPaths([
    join(scanDir, "**/*.ts"),
    join(scanDir, "**/*.js"),
    "!" + join(scanDir, "**/*.test.*"),
    "!" + join(scanDir, "**/*.spec.*"),
    "!" + join(scanDir, "**/node_modules/**"),
  ]);

  const routes: ExtractedRoute[] = [];
  const routePrefixes = new Map<string, string>(); // variable name → prefix

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();

    // Find app.route("/prefix", subApp) calls
    for (const call of sourceFile.getDescendantsOfKind(tsMorph.SyntaxKind.CallExpression)) {
      const expr = call.getExpression();
      if (!tsMorph.Node.isPropertyAccessExpression(expr)) continue;
      if (expr.getName() !== "route") continue;

      const args = call.getArguments();
      if (args.length >= 2) {
        const first = args[0];
        const second = args[1];
        if (
          first &&
          second &&
          tsMorph.Node.isStringLiteral(first) &&
          tsMorph.Node.isIdentifier(second)
        ) {
          routePrefixes.set(second.getText(), first.getLiteralValue());
        }
      }
    }

    // Find HTTP method calls
    for (const call of sourceFile.getDescendantsOfKind(tsMorph.SyntaxKind.CallExpression)) {
      const expr = call.getExpression();
      if (!tsMorph.Node.isPropertyAccessExpression(expr)) continue;

      const methodName = expr.getName().toLowerCase();
      if (!(HTTP_METHODS as readonly string[]).includes(methodName)) continue;

      const args = call.getArguments();
      if (args.length === 0) continue;

      const firstArg = args[0]!;
      if (!tsMorph.Node.isStringLiteral(firstArg)) continue;

      let path = firstArg.getLiteralValue();

      // Check mount prefix via .route()
      const receiver = expr.getExpression();
      if (tsMorph.Node.isIdentifier(receiver)) {
        const prefix = routePrefixes.get(receiver.getText());
        if (prefix) {
          path = prefix.replace(/\/$/, "") + "/" + path.replace(/^\//, "");
        }
      }

      // Normalise: "/" root handling
      if (path === "/" || path === "") {
        const receiver2 = expr.getExpression();
        if (tsMorph.Node.isIdentifier(receiver2)) {
          const prefix = routePrefixes.get(receiver2.getText());
          if (prefix) path = prefix;
        }
      }

      path = "/" + path.replace(/^\/+/, "").replace(/\/+$/, "");

      const params = [...path.matchAll(/:(\w+)/g)].map((m) => m[1]!);

      routes.push({
        method: methodName.toUpperCase() as HttpMethod,
        path,
        params,
        file: filePath,
        line: call.getStartLineNumber(),
      });
    }
  }

  return routes;
}
```

- [ ] **Step 5: Run tests to verify they pass**

- [ ] **Step 6: Commit**

```bash
git add packages/check/src/extractors/hono.* packages/check/test/fixtures/hono-app.ts
git commit -m "feat(check): add Hono route extractor"
```

---

## Task 5: Next.js App Router Extractor

**Files:**
- Create: `packages/check/src/extractors/nextjs.ts`
- Create: `packages/check/src/extractors/nextjs.test.ts`
- Create: `packages/check/test/fixtures/nextjs-app/api/users/route.ts`
- Create: `packages/check/test/fixtures/nextjs-app/api/users/[id]/route.ts`
- Create: `packages/check/test/fixtures/nextjs-app/api/posts/route.ts`

- [ ] **Step 1: Create Next.js fixtures**

`packages/check/test/fixtures/nextjs-app/api/users/route.ts`:
```typescript
export async function GET() {
  return Response.json([]);
}

export async function POST() {
  return Response.json({}, { status: 201 });
}
```

`packages/check/test/fixtures/nextjs-app/api/users/[id]/route.ts`:
```typescript
export async function GET() {
  return Response.json({});
}

export async function DELETE() {
  return new Response(null, { status: 204 });
}
```

`packages/check/test/fixtures/nextjs-app/api/posts/route.ts`:
```typescript
export async function GET() {
  return Response.json([]);
}
```

- [ ] **Step 2: Write failing test**

```typescript
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
});
```

- [ ] **Step 3: Run test to verify it fails**

- [ ] **Step 4: Implement Next.js extractor**

This is file-system based — no ts-morph needed for directory walking, only for detecting exported HTTP method functions.

`packages/check/src/extractors/nextjs.ts`:
```typescript
import type { ExtractedRoute, HttpMethod } from "../types.js";
import { join } from "node:path";
import { readdir, stat } from "node:fs/promises";

const HTTP_METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export async function extractNextjsRoutes(
  projectDir: string,
  appDir?: string,
): Promise<ExtractedRoute[]> {
  const scanDir = join(projectDir, appDir || "app");
  const routes: ExtractedRoute[] = [];

  await walkAppDir(scanDir, "", routes);
  return routes;
}

async function walkAppDir(
  dir: string,
  pathPrefix: string,
  routes: ExtractedRoute[],
): Promise<void> {
  let entries;
  try {
    entries = await readdir(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const entryStat = await stat(fullPath);

    if (entryStat.isDirectory()) {
      // Route groups: (group) → ignored in path
      if (entry.startsWith("(") && entry.endsWith(")")) {
        await walkAppDir(fullPath, pathPrefix, routes);
        continue;
      }

      // Dynamic segments: [param] → :param, [...slug] → :slug*
      let segment = entry;
      if (entry.startsWith("[") && entry.endsWith("]")) {
        const inner = entry.slice(1, -1);
        if (inner.startsWith("...")) {
          segment = ":" + inner.slice(3) + "*";
        } else {
          segment = ":" + inner;
        }
      }

      await walkAppDir(fullPath, pathPrefix + "/" + segment, routes);
    } else if (entry === "route.ts" || entry === "route.js") {
      // Found a route file — detect exported HTTP methods
      const methods = await detectExportedMethods(fullPath);
      const routePath = pathPrefix || "/";
      const params = [...routePath.matchAll(/:(\w+)/g)].map((m) => m[1]!);

      for (const method of methods) {
        routes.push({
          method,
          path: routePath,
          params,
          file: fullPath,
          line: 1,
        });
      }
    }
  }
}

async function detectExportedMethods(filePath: string): Promise<HttpMethod[]> {
  let tsMorph: typeof import("ts-morph");
  try {
    tsMorph = await import("ts-morph");
  } catch {
    throw new Error("ts-morph is required. Install it: pnpm add -D ts-morph");
  }

  const project = new tsMorph.Project({ skipAddingFilesFromTsConfig: true });
  const sourceFile = project.addSourceFileAtPath(filePath);

  const methods: HttpMethod[] = [];
  for (const method of HTTP_METHODS) {
    // Check for: export async function GET() or export function GET()
    const fn = sourceFile.getFunction(method);
    if (fn && fn.isExported()) {
      methods.push(method);
      continue;
    }

    // Check for: export const GET = ...
    const varDecl = sourceFile.getVariableDeclaration(method);
    if (varDecl) {
      const stmt = varDecl.getVariableStatement();
      if (stmt && stmt.isExported()) {
        methods.push(method);
      }
    }
  }

  return methods;
}
```

- [ ] **Step 5: Run tests to verify they pass**

- [ ] **Step 6: Commit**

```bash
git add packages/check/src/extractors/nextjs.* packages/check/test/fixtures/nextjs-app/
git commit -m "feat(check): add Next.js App Router route extractor"
```

---

## Task 6: TypeScript Type Extractor

**Files:**
- Create: `packages/check/src/extractors/typescript.ts`
- Create: `packages/check/src/extractors/typescript.test.ts`
- Create: `packages/check/test/fixtures/types.ts`

- [ ] **Step 1: Create TypeScript fixture**

`packages/check/test/fixtures/types.ts`:
```typescript
export interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  createdAt: Date;
}

export interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  publishedAt?: Date;
}

export type UserRole = "admin" | "user";
```

- [ ] **Step 2: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { extractTypeScriptTypes } from "./typescript.js";
import { join } from "node:path";

describe("extractTypeScriptTypes", () => {
  const fixtureDir = join(import.meta.dirname, "../../test/fixtures");

  it("extracts interfaces", async () => {
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
});
```

- [ ] **Step 3: Run test to verify it fails**

- [ ] **Step 4: Implement TypeScript type extractor**

`packages/check/src/extractors/typescript.ts` — uses ts-morph to find `interface` and `type` (object-like) declarations, extracts field names, types, and optional markers.

- [ ] **Step 5: Run tests to verify they pass**

- [ ] **Step 6: Commit**

```bash
git add packages/check/src/extractors/typescript.* packages/check/test/fixtures/types.ts
git commit -m "feat(check): add TypeScript type/interface extractor"
```

---

## Task 7: Zod Schema Extractor

**Files:**
- Create: `packages/check/src/extractors/zod.ts`
- Create: `packages/check/src/extractors/zod.test.ts`
- Create: `packages/check/test/fixtures/zod-schemas.ts`

- [ ] **Step 1: Create Zod fixture**

`packages/check/test/fixtures/zod-schemas.ts`:
```typescript
import { z } from "zod";

export const UserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(["admin", "user"]),
  createdAt: z.date(),
});

export const PostSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  authorId: z.string(),
  publishedAt: z.date().optional(),
});
```

- [ ] **Step 2: Write failing test**

```typescript
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
});
```

- [ ] **Step 3: Run test to verify it fails**

- [ ] **Step 4: Implement Zod extractor**

Uses ts-morph to find `z.object({...})` calls. Strips `Schema`/`schema` suffix from variable name. Maps `z.string()` → `string`, `z.number()` → `number`, `z.date()` → `Date`, `z.boolean()` → `boolean`, `z.enum([...])` → union. Detects `.optional()` chaining.

- [ ] **Step 5: Run tests to verify they pass**

- [ ] **Step 6: Commit**

```bash
git add packages/check/src/extractors/zod.* packages/check/test/fixtures/zod-schemas.ts
git commit -m "feat(check): add Zod schema extractor"
```

---

## Task 8: Prisma Model Extractor

**Files:**
- Create: `packages/check/src/extractors/prisma.ts`
- Create: `packages/check/src/extractors/prisma.test.ts`
- Create: `packages/check/test/fixtures/schema.prisma`

- [ ] **Step 1: Create Prisma fixture**

`packages/check/test/fixtures/schema.prisma`:
```prisma
model User {
  id        String   @id @default(uuid())
  name      String
  email     String   @unique
  role      String   @default("user")
  createdAt DateTime @default(now())
  posts     Post[]
}

model Post {
  id          String    @id @default(uuid())
  title       String
  content     String
  authorId    String
  publishedAt DateTime?
  author      User      @relation(fields: [authorId], references: [id])
}
```

- [ ] **Step 2: Write failing test**

```typescript
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
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

- [ ] **Step 4: Implement Prisma extractor (regex-based, no ts-morph)**

`packages/check/src/extractors/prisma.ts`:
```typescript
import type { ExtractedType } from "../types.js";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const PRISMA_TYPE_MAP: Record<string, string> = {
  String: "string",
  Int: "number",
  Float: "number",
  Decimal: "number",
  BigInt: "number",
  Boolean: "boolean",
  DateTime: "Date",
  Json: "unknown",
  Bytes: "Buffer",
};

const MODEL_RE = /^model\s+(\w+)\s*\{([^}]+)\}/gm;
const FIELD_RE = /^\s+(\w+)\s+(\w+)(\??)\s*(.*)?$/gm;

export async function extractPrismaModels(projectDir: string): Promise<ExtractedType[]> {
  const schemaPath = join(projectDir, "schema.prisma");
  let content: string;
  try {
    content = await readFile(schemaPath, "utf-8");
  } catch {
    return [];
  }

  const models: ExtractedType[] = [];
  let modelMatch;
  const modelRe = new RegExp(MODEL_RE.source, "gm");

  while ((modelMatch = modelRe.exec(content)) !== null) {
    const name = modelMatch[1]!;
    const body = modelMatch[2]!;
    const fields: ExtractedType["fields"] = [];
    const lineOffset = content.slice(0, modelMatch.index).split("\n").length;

    for (const line of body.split("\n")) {
      const fieldMatch = /^\s+(\w+)\s+(\w+)(\??)/.exec(line);
      if (!fieldMatch) continue;

      const fieldName = fieldMatch[1]!;
      const prismaType = fieldMatch[2]!;
      const optional = fieldMatch[3] === "?";

      // Skip relation fields (type is another model or array)
      if (line.includes("@relation") || prismaType.endsWith("[]")) continue;

      const tsType = PRISMA_TYPE_MAP[prismaType] ?? prismaType.toLowerCase();

      fields.push({ name: fieldName, type: tsType, optional });
    }

    models.push({ name, fields, file: schemaPath, line: lineOffset });
  }

  return models;
}
```

- [ ] **Step 5: Run tests to verify they pass**

- [ ] **Step 6: Commit**

```bash
git add packages/check/src/extractors/prisma.* packages/check/test/fixtures/schema.prisma
git commit -m "feat(check): add Prisma model extractor (regex-based)"
```

---

## Task 9: Route Matcher

**Files:**
- Create: `packages/check/src/matchers/routes.ts`
- Create: `packages/check/src/matchers/routes.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
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
    const findings = matchRoutes(specEndpoints, specEndpoints.map((e) => ({
      ...e, file: "routes.ts", line: 1,
    })), "api-contract");
    expect(findings).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement route matcher**

`packages/check/src/matchers/routes.ts`:
```typescript
import type { Finding, SpecEndpoint, ExtractedRoute } from "../types.js";

function normalisePath(path: string): string {
  return "/" + path.replace(/^\/+/, "").replace(/\/+$/, "").replace(/\/+/g, "/");
}

export function matchRoutes(
  specEndpoints: SpecEndpoint[],
  codeRoutes: ExtractedRoute[],
  specId: string,
): Finding[] {
  const findings: Finding[] = [];

  const codeSet = new Set(
    codeRoutes.map((r) => `${r.method} ${normalisePath(r.path)}`),
  );
  const specSet = new Set(
    specEndpoints.map((e) => `${e.method} ${normalisePath(e.path)}`),
  );

  // Missing: in spec but not code
  for (const endpoint of specEndpoints) {
    const key = `${endpoint.method} ${normalisePath(endpoint.path)}`;
    if (!codeSet.has(key)) {
      findings.push({
        type: "missing",
        category: "route",
        specId,
        specSection: "Endpoints",
        expected: key,
        severity: "error",
        suggestion: `Implement ${key} in your route handler`,
      });
    }
  }

  // Extra: in code but not spec
  for (const route of codeRoutes) {
    const key = `${route.method} ${normalisePath(route.path)}`;
    if (!specSet.has(key)) {
      findings.push({
        type: "extra",
        category: "route",
        specId,
        codeLocation: { file: route.file, line: route.line },
        expected: "(not in spec)",
        actual: key,
        severity: "info",
        suggestion: `Route ${key} exists in code but not in spec — add to spec if intentional`,
      });
    }
  }

  return findings;
}
```

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add packages/check/src/matchers/routes.*
git commit -m "feat(check): add route matcher (spec endpoints vs code routes)"
```

---

## Task 10: Type Matcher

**Files:**
- Create: `packages/check/src/matchers/types.ts`
- Create: `packages/check/src/matchers/types.test.ts`

- [ ] **Step 1: Write failing test**

Test fuzzy name matching (User vs UserModel), field comparison (missing/extra/mismatched fields), optional detection.

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement type matcher**

Normalise type names (lowercase, strip suffixes: Schema, Model, Type, Interface). For each spec type, find best-matching code type. Compare field by field. Report missing/extra/mismatched fields.

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add packages/check/src/matchers/types.*
git commit -m "feat(check): add type matcher (spec data model vs code types)"
```

---

## Task 11: Test Coverage Matcher

**Files:**
- Create: `packages/check/src/matchers/tests.ts`
- Create: `packages/check/src/matchers/tests.test.ts`
- Create: `packages/check/test/fixtures/sample.test.ts`

- [ ] **Step 1: Create test fixture**

`packages/check/test/fixtures/sample.test.ts`:
```typescript
describe("UserService", () => {
  it("should create a new user", () => {});
  it("should reject invalid email", () => {});
  it("should list all users", () => {});
});
```

- [ ] **Step 2: Write failing test**

Test Jaccard similarity matching between spec test case descriptions and actual test descriptions.

- [ ] **Step 3: Run test to verify it fails**

- [ ] **Step 4: Implement test matcher with Jaccard similarity**

Extract test descriptions from code using ts-morph (find `it()` / `test()` / `describe()` string literals). Normalise words (lowercase, remove punctuation). Compute Jaccard similarity = |intersection| / |union|. Threshold: 0.4.

- [ ] **Step 5: Write test extractor**

`packages/check/src/extractors/test-extractor.ts` — uses ts-morph to find `it()`, `test()`, and `describe()` calls and extract their string descriptions.

- [ ] **Step 6: Run tests to verify they pass**

- [ ] **Step 7: Commit**

```bash
git add packages/check/src/matchers/tests.* packages/check/src/extractors/test-extractor.* packages/check/test/fixtures/sample.test.ts
git commit -m "feat(check): add test coverage matcher with Jaccard similarity"
```

---

## Task 12: Completeness Scorer

**Files:**
- Create: `packages/check/src/score.ts`
- Create: `packages/check/src/score.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
import { describe, it, expect } from "vitest";
import { computeScore } from "./score.js";
import type { Finding } from "./types.js";

describe("computeScore", () => {
  it("computes 100% when no findings", () => {
    const score = computeScore([], { routes: 5, types: 10, tests: 8 });
    expect(score.overall).toBe(100);
  });

  it("computes correct percentage with missing items", () => {
    const findings: Finding[] = [
      { type: "missing", category: "route", specId: "x", expected: "GET /a", severity: "error" },
      { type: "missing", category: "route", specId: "x", expected: "GET /b", severity: "error" },
      { type: "missing", category: "type", specId: "x", expected: "field x", severity: "warn" },
    ];
    const score = computeScore(findings, { routes: 5, types: 10, tests: 8 });
    expect(score.overall).toBe(Math.round(((5 - 2 + 10 - 1 + 8) / (5 + 10 + 8)) * 100));
    expect(score.byCategory["routes"]).toEqual({ matched: 3, total: 5 });
  });

  it("ignores extra and info findings in score", () => {
    const findings: Finding[] = [
      { type: "extra", category: "route", specId: "x", expected: "", severity: "info" },
    ];
    const score = computeScore(findings, { routes: 5, types: 0, tests: 0 });
    expect(score.overall).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement scorer**

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Commit**

```bash
git add packages/check/src/score.*
git commit -m "feat(check): add implementation completeness scorer"
```

---

## Task 13: Check Orchestrator

**Files:**
- Create: `packages/check/src/check.ts`
- Create: `packages/check/src/check.test.ts`

- [ ] **Step 1: Write failing integration test**

Uses fixture files to run a full check: parse specs → extract routes/types → match → score. Test with mock ParsedSpec objects containing the right section content.

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement orchestrator**

`packages/check/src/check.ts`:
```typescript
import type { CheckResult, CheckConfig } from "./types.js";
import type { ParsedSpec } from "@specdx/core";
import { parseEndpoints, parseTypeDefinitions, parseTestCases } from "./spec-parsers.js";
import { matchRoutes } from "./matchers/routes.js";
import { matchTypes } from "./matchers/types.js";
import { matchTests } from "./matchers/tests.js";
import { computeScore } from "./score.js";

export async function runCheck(
  specs: ParsedSpec[],
  projectDir: string,
  config: CheckConfig = {},
): Promise<CheckResult> {
  // 1. Detect framework from package.json if config.framework is "auto" or undefined
  // 2. For api-contract specs → parse endpoints → extract routes → match
  // 3. For technical-design specs → parse type defs → extract types → match
  // 4. For test-plan specs → parse test cases → extract tests → match
  // 5. Compute score
  // 6. Generate summary
}
```

- [ ] **Step 4: Update src/index.ts with all exports**

- [ ] **Step 5: Run tests to verify they pass**

- [ ] **Step 6: Commit**

```bash
git add packages/check/src/check.* packages/check/src/index.ts
git commit -m "feat(check): add check orchestrator that runs all matchers"
```

---

## Task 14: Schema Extension

**Files:**
- Modify: `packages/schema/src/types.ts`
- Modify: `packages/schema/src/schemas/config.json`

- [ ] **Step 1: Add CheckConfig to SdxConfig type**

In `packages/schema/src/types.ts`, add the `check` field to `SdxConfig`:
```typescript
check?: {
  framework?: "auto" | "express" | "hono" | "nextjs";
  routes_dir?: string;
  app_dir?: string;
  types_dir?: string;
  tests_dir?: string;
  ignore?: string[];
};
```

- [ ] **Step 2: Add check block to config JSON schema**

In `packages/schema/src/schemas/config.json`, add the `check` property alongside `lint`, `pack`, `diff`, `ci`.

- [ ] **Step 3: Run schema tests to verify nothing breaks**

```bash
pnpm --filter @specdx/schema test
```

- [ ] **Step 4: Commit**

```bash
git add packages/schema/src/types.ts packages/schema/src/schemas/config.json
git commit -m "feat(schema): add check config to SdxConfig"
```

---

## Task 15: CLI Command + Bundling

**Files:**
- Create: `packages/cli/src/commands/check.ts`
- Create: `packages/cli/src/commands/check.test.ts`
- Modify: `packages/cli/src/main.ts`
- Modify: `packages/cli/tsup.config.ts`

- [ ] **Step 1: Add @specdx/check to tsup.config.ts noExternal**

In both entry configs in `packages/cli/tsup.config.ts`, add `"@specdx/check"` to the `noExternal` arrays. Also add `"ts-morph"` to the `external` arrays (so it's not bundled — lazy-loaded at runtime).

- [ ] **Step 2: Create check command**

`packages/cli/src/commands/check.ts`:
```typescript
import { defineCommand } from "citty";
import { loadConfig, parseSpec, resolveGlob, createLogger } from "@specdx/core";
import { runCheck } from "@specdx/check";
import type { ParsedSpec } from "@specdx/core";
import { sharedArgs } from "../shared-args.js";

export default defineCommand({
  meta: { name: "check", description: "Check spec-to-implementation drift" },
  args: {
    ...sharedArgs,
    spec: { type: "string", description: "Check a specific spec by ID" },
    framework: { type: "string", description: "Framework override: express, hono, nextjs" },
  },
  async run({ args }) {
    const logger = createLogger({ quiet: args.quiet, verbose: args.verbose });
    const configDir = process.cwd();
    const config = await loadConfig(undefined, configDir);

    // Resolve and parse all specs
    const specs: ParsedSpec[] = [];
    for (const [, entry] of Object.entries(config.specs)) {
      const paths = await resolveGlob(entry.path, configDir);
      for (const p of paths) {
        const spec = await parseSpec(p);
        if (args.spec && spec.frontmatter.id !== args.spec) continue;
        specs.push(spec);
      }
    }

    const checkConfig = {
      ...config.check,
      ...(args.framework ? { framework: args.framework } : {}),
    };

    const result = await runCheck(specs, configDir, checkConfig);

    if (args.format === "json") {
      console.log(JSON.stringify(result, null, 2));
    } else {
      // Pretty format
      console.log(`\n  sdx check — ${result.score.overall}% implementation coverage\n`);

      for (const [category, stats] of Object.entries(result.score.byCategory)) {
        console.log(`  ${category} (${stats.matched}/${stats.total}):`);
        const categoryFindings = result.findings.filter((f) => f.category === category);
        for (const f of categoryFindings) {
          const icon = f.type === "extra" ? "ℹ" : "✗";
          console.log(`    ${icon} ${f.expected}${f.actual ? ` — ${f.actual}` : ""}`);
        }
        if (categoryFindings.length === 0) {
          console.log("    ✓ all matched");
        }
      }

      const errors = result.findings.filter((f) => f.severity === "error").length;
      const warnings = result.findings.filter((f) => f.severity === "warn").length;
      console.log(`\n  ${errors} errors, ${warnings} warnings\n`);
    }

    if (result.findings.some((f) => f.severity === "error")) {
      process.exit(1);
    }
  },
});
```

- [ ] **Step 3: Register check command in main.ts**

Add to subCommands: `check: () => import("./commands/check.js").then((m) => m.default),`

- [ ] **Step 4: Write CLI integration test**

Test `runCheck` with a temp directory containing a spec + Express routes. Verify it returns findings.

- [ ] **Step 5: Build and test full suite**

```bash
pnpm build && pnpm test && pnpm typecheck && pnpm lint:code
```

- [ ] **Step 6: Smoke test the CLI**

```bash
node packages/cli/dist/main.js check --help
node packages/cli/dist/main.js check --format json
```

- [ ] **Step 7: Commit**

```bash
git add packages/cli/
git commit -m "feat(cli): add sdx check command for spec-to-implementation analysis"
```

---

## Task 16: Framework Auto-Detection

**Files:**
- Create: `packages/check/src/detect-framework.ts`
- Create: `packages/check/src/detect-framework.test.ts`

- [ ] **Step 1: Write failing test**

Test reading package.json to detect framework from dependencies.

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement framework detection**

Read `package.json` from project root. Check `dependencies` and `devDependencies` for `express`, `hono`, `next`. Return the first match or `null`.

- [ ] **Step 4: Wire into check orchestrator**

Update `check.ts` to call `detectFramework()` when `config.framework` is `"auto"` or undefined.

- [ ] **Step 5: Run tests to verify they pass**

- [ ] **Step 6: Commit**

```bash
git add packages/check/src/detect-framework.*
git commit -m "feat(check): add framework auto-detection from package.json"
```

---

## Task 17: Final Integration + Cleanup

- [ ] **Step 1: Update packages/check/src/index.ts with all public exports**

Export: `runCheck`, `CheckResult`, `Finding`, `ImplementationScore`, `CheckConfig`, all extractors, all matchers, `computeScore`.

- [ ] **Step 2: Run full test suite**

```bash
pnpm build && pnpm test && pnpm typecheck && pnpm lint:code
```
Expected: all pass, 230+ tests total.

- [ ] **Step 3: Run sdx check on sdx itself (smoke test)**

```bash
node packages/cli/dist/main.js check
```

This won't find routes/types (sdx is a CLI tool, not an API), but should run without errors and report 0 findings or info-level findings.

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "feat(check): complete @specdx/check package — spec-to-implementation analysis"
```

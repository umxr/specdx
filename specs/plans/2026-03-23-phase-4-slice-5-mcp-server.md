# Phase 4 Slice 5 — MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose sdx as a Model Context Protocol server so LLMs (Claude Desktop, Cursor, etc.) can query spec health, pack context, and run checks directly via `sdx mcp`.

**Architecture:** New `packages/mcp/` package using `@modelcontextprotocol/sdk` to create a stdio-based MCP server. Each tool delegates to existing programmatic APIs from the CLI commands (`runLint`, `runStatus`, `runDiff`, `runPack`, `runCheck`). The CLI gets a new `sdx mcp` command that starts the server. Methodology modules and adapter docs are deferred.

**Tech Stack:** TypeScript (ESM only), `@modelcontextprotocol/sdk`, Vitest

**Design spec:** `specs/designs/2026-03-20-phase-4-spec-intelligence-design.md` (Slice 5 section)

---

## File Structure

```
packages/mcp/                              # NEW PACKAGE
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── index.ts                           # exports
    ├── server.ts                          # MCP server setup + tool registration
    ├── server.test.ts                     # tests
    └── tools/
        ├── validate.ts                    # sdx_validate tool
        ├── lint.ts                        # sdx_lint tool
        ├── pack.ts                        # sdx_pack tool
        ├── status.ts                      # sdx_status tool
        ├── check.ts                       # sdx_check tool
        ├── diff.ts                        # sdx_diff tool
        └── graph.ts                       # sdx_graph tool

packages/cli/src/commands/mcp.ts           # CREATE: sdx mcp command
packages/cli/src/main.ts                   # MODIFY: register mcp command
packages/cli/tsup.config.ts               # MODIFY: add @specdx/mcp to noExternal, @modelcontextprotocol/sdk to external
```

---

## Task 1: Package Scaffolding

**Files:**
- Create: `packages/mcp/package.json`
- Create: `packages/mcp/tsconfig.json`
- Create: `packages/mcp/vitest.config.ts`
- Create: `packages/mcp/src/index.ts`

- [x] **Step 1: Create package.json**

```json
{
  "name": "@specdx/mcp",
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
    "@specdx/core": "workspace:*",
    "@specdx/lint": "workspace:*",
    "@specdx/pack": "workspace:*",
    "@specdx/diff": "workspace:*",
    "@specdx/check": "workspace:*",
    "@modelcontextprotocol/sdk": "^1.27.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

- [x] **Step 2: Create tsconfig.json**

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
    { "path": "../core" },
    { "path": "../lint" },
    { "path": "../pack" },
    { "path": "../diff" },
    { "path": "../check" }
  ]
}
```

- [x] **Step 3: Create vitest.config.ts**

```typescript
import { mergeConfig } from "vitest/config";
import shared from "../../vitest.shared.js";

export default mergeConfig(shared, {});
```

- [x] **Step 4: Create src/index.ts (placeholder)**

```typescript
export { createMcpServer } from "./server.js";
```

- [x] **Step 5: Install dependencies**

```bash
pnpm install
```

- [x] **Step 6: Commit**

```bash
git add packages/mcp/
git commit -m "feat(mcp): scaffold @specdx/mcp package"
```

---

## Task 2: Tool Implementations

Each tool is a thin wrapper that calls existing programmatic APIs.

**Files to create:**
- `packages/mcp/src/tools/validate.ts`
- `packages/mcp/src/tools/lint.ts`
- `packages/mcp/src/tools/pack.ts`
- `packages/mcp/src/tools/status.ts`
- `packages/mcp/src/tools/check.ts`
- `packages/mcp/src/tools/diff.ts`
- `packages/mcp/src/tools/graph.ts`

- [x] **Step 1: Create validate tool**

`packages/mcp/src/tools/validate.ts`:

```typescript
import { loadConfig, ConfigError } from "@specdx/core";

export async function handleValidate(params: { configPath?: string }): Promise<string> {
  try {
    const configDir = params.configPath ?? process.cwd();
    const config = await loadConfig(undefined, configDir);
    return JSON.stringify({
      valid: true,
      specCount: Object.keys(config.specs).length,
      project: config.project?.name ?? "unknown",
    });
  } catch (err) {
    if (err instanceof ConfigError) {
      return JSON.stringify({ valid: false, error: err.message, details: err.errors });
    }
    throw err;
  }
}
```

- [x] **Step 2: Create lint tool**

`packages/mcp/src/tools/lint.ts`:

```typescript
import { loadConfig, parseSpec, resolveGlob, buildGraph } from "@specdx/core";
import { createLintEngine, getPreset } from "@specdx/lint";
import type { ParsedSpec } from "@specdx/core";

export async function handleLint(params: { preset?: string; specPath?: string }): Promise<string> {
  const configDir = process.cwd();
  const config = await loadConfig(undefined, configDir);
  const preset = params.preset ?? config.lint?.extends ?? "recommended";
  const rules = getPreset(preset);

  const specs: ParsedSpec[] = [];
  for (const [, entry] of Object.entries(config.specs)) {
    const files = await resolveGlob(entry.path, configDir);
    for (const file of files) {
      if (params.specPath && !file.includes(params.specPath)) continue;
      specs.push(await parseSpec(file));
    }
  }

  let graph;
  try {
    graph = buildGraph(config);
  } catch {
    // non-fatal
  }

  const engine = createLintEngine({ rules, config, graph });
  const results = engine.lint(specs);

  return JSON.stringify({
    diagnostics: results.diagnostics,
    hasErrors: results.hasErrors,
    hasWarnings: results.hasWarnings,
    specsChecked: specs.length,
  });
}
```

- [x] **Step 3: Create pack tool**

`packages/mcp/src/tools/pack.ts`:

```typescript
import { loadConfig, parseSpec, resolveGlob, buildGraph } from "@specdx/core";
import { pack } from "@specdx/pack";
import type { ParsedSpec } from "@specdx/core";

export async function handlePack(params: {
  task?: string;
  format?: string;
  budget?: number;
}): Promise<string> {
  const configDir = process.cwd();
  const config = await loadConfig(undefined, configDir);

  const allSpecs: ParsedSpec[] = [];
  for (const [, entry] of Object.entries(config.specs)) {
    const files = await resolveGlob(entry.path, configDir);
    for (const file of files) {
      allSpecs.push(await parseSpec(file));
    }
  }

  let graph;
  try {
    graph = buildGraph(config);
  } catch {
    // non-fatal
  }

  const result = pack(
    allSpecs,
    {
      task: params.task,
      budget: params.budget,
      format: (params.format as "xml" | "markdown" | "json") ?? undefined,
    },
    config.pack,
    graph,
  );

  return result.output;
}
```

- [x] **Step 4: Create status tool**

`packages/mcp/src/tools/status.ts`:

```typescript
import { loadConfig, parseSpec, resolveGlob, buildGraph } from "@specdx/core";
import { createLintEngine, getPreset } from "@specdx/lint";
import { DEFAULT_DIFF_CONFIG } from "@specdx/diff";
import type { StatusResult } from "@specdx/diff";
import type { ParsedSpec } from "@specdx/core";

export async function handleStatus(): Promise<string> {
  const configDir = process.cwd();
  const config = await loadConfig(undefined, configDir);

  const specs: { spec: ParsedSpec; entry: { path: string; owner?: string } }[] = [];
  for (const [, entry] of Object.entries(config.specs)) {
    const paths = await resolveGlob(entry.path, configDir);
    for (const p of paths) {
      const spec = await parseSpec(p);
      specs.push({ spec, entry: entry as { path: string; owner?: string } });
    }
  }

  const byStatus: Record<string, number> = {};
  for (const { spec } of specs) {
    const status = (spec.frontmatter.status as string) || "unknown";
    byStatus[status] = (byStatus[status] ?? 0) + 1;
  }

  const presetName = config.lint?.extends ?? "recommended";
  const rules = getPreset(presetName);

  let graph;
  let graphError: string | undefined;
  try {
    graph = buildGraph(config);
  } catch (err) {
    graphError = (err as Error).message;
  }

  const engine = createLintEngine({ rules, config, graph });
  const lintResults = engine.lint(specs.map((s) => s.spec));

  const errors = lintResults.diagnostics.filter((d) => d.severity === "error").length;
  const warnings = lintResults.diagnostics.filter((d) => d.severity === "warn").length;

  const thresholdDays = config.diff?.staleness_threshold_days ?? DEFAULT_DIFF_CONFIG.staleness_threshold_days;
  const now = Date.now();
  const staleSpecs: { specId: string; daysSinceUpdate: number }[] = [];
  for (const { spec } of specs) {
    const dateStr = (spec.frontmatter.updated as string | undefined) || (spec.frontmatter.created as string | undefined);
    if (dateStr) {
      const days = Math.floor((now - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
      if (days > thresholdDays) {
        staleSpecs.push({ specId: spec.frontmatter.id as string, daysSinceUpdate: days });
      }
    }
  }

  let verdict: "healthy" | "warnings" | "errors" = "healthy";
  if (errors > 0 || graphError) verdict = "errors";
  else if (warnings > 0 || staleSpecs.length > 0) verdict = "warnings";

  const result: StatusResult = {
    project: config.project?.name ?? "unknown",
    specCount: specs.length,
    byStatus,
    lintHealth: { errors, warnings, passing: specs.length - errors },
    staleSpecs,
    integrityIssues: graphError ? [graphError] : [],
    verdict,
  };

  return JSON.stringify(result);
}
```

- [x] **Step 5: Create check tool**

`packages/mcp/src/tools/check.ts`:

```typescript
import { loadConfig, parseSpec, resolveGlob } from "@specdx/core";
import { runCheck } from "@specdx/check";
import type { ParsedSpec } from "@specdx/core";

export async function handleCheck(params: { framework?: string; specId?: string }): Promise<string> {
  const configDir = process.cwd();
  const config = await loadConfig(undefined, configDir);

  const specs: ParsedSpec[] = [];
  for (const [, entry] of Object.entries(config.specs)) {
    const paths = await resolveGlob(entry.path, configDir);
    for (const p of paths) {
      const spec = await parseSpec(p);
      if (params.specId && spec.frontmatter.id !== params.specId) continue;
      specs.push(spec);
    }
  }

  const checkConfig = {
    ...config.check,
    ...(params.framework ? { framework: params.framework as "express" | "hono" | "nextjs" } : {}),
  };

  const result = await runCheck(specs, configDir, checkConfig);
  return JSON.stringify(result);
}
```

- [x] **Step 6: Create diff tool**

`packages/mcp/src/tools/diff.ts`:

```typescript
import { join } from "node:path";
import { loadConfig } from "@specdx/core";
import { diffBetweenRefs, DEFAULT_DIFF_CONFIG, DiffError } from "@specdx/diff";

export async function handleDiff(params: { base?: string; head?: string }): Promise<string> {
  const configDir = process.cwd();
  const config = await loadConfig(undefined, configDir);
  const baseRef = params.base ?? config.diff?.baseline_ref ?? DEFAULT_DIFF_CONFIG.baseline_ref;
  const headRef = params.head ?? "HEAD";
  const configPath = join(configDir, "spec.config.yaml");

  try {
    const result = await diffBetweenRefs(configPath, baseRef, headRef);
    return JSON.stringify(result);
  } catch (err) {
    if (err instanceof DiffError) {
      return JSON.stringify({ error: err.message });
    }
    throw err;
  }
}
```

- [x] **Step 7: Create graph tool**

`packages/mcp/src/tools/graph.ts`:

```typescript
import { loadConfig, buildGraph, GraphError } from "@specdx/core";

export async function handleGraph(params: { format?: string }): Promise<string> {
  const configDir = process.cwd();
  const config = await loadConfig(undefined, configDir);

  try {
    const graph = buildGraph(config);
    const sorted = graph.topologicalSort();

    if (params.format === "dot") {
      const lines = ["digraph specs {"];
      for (const edge of graph.edges) lines.push(`  "${edge.from}" -> "${edge.to}";`);
      lines.push("}");
      return lines.join("\n");
    }

    return JSON.stringify({
      nodes: sorted,
      edges: graph.edges,
      downstream: Object.fromEntries(sorted.map((n) => [n, graph.getDownstream(n)])),
    });
  } catch (err) {
    if (err instanceof GraphError) {
      return JSON.stringify({ error: err.message });
    }
    throw err;
  }
}
```

- [x] **Step 8: Commit**

```bash
git add packages/mcp/src/tools/
git commit -m "feat(mcp): add tool handlers for validate, lint, pack, status, check, diff, graph"
```

---

## Task 3: MCP Server

Wire all tools into an MCP server using `@modelcontextprotocol/sdk`.

**Files:**
- Create: `packages/mcp/src/server.ts`
- Create: `packages/mcp/src/server.test.ts`
- Modify: `packages/mcp/src/index.ts`

- [x] **Step 1: Write test**

`packages/mcp/src/server.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createMcpServer } from "./server.js";

describe("createMcpServer", () => {
  it("creates a server with all tools registered", () => {
    const server = createMcpServer();
    expect(server).toBeDefined();
  });
});
```

(Full integration tests would require spawning the server on stdio — unit test just verifies the server object is created. Real testing is via smoke test in Task 5.)

- [x] **Step 2: Implement server.ts**

`packages/mcp/src/server.ts`:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleValidate } from "./tools/validate.js";
import { handleLint } from "./tools/lint.js";
import { handlePack } from "./tools/pack.js";
import { handleStatus } from "./tools/status.js";
import { handleCheck } from "./tools/check.js";
import { handleDiff } from "./tools/diff.js";
import { handleGraph } from "./tools/graph.js";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "specdx",
    version: "0.3.0",
  });

  server.tool(
    "sdx_validate",
    "Validate the spec.config.yaml configuration file",
    { configPath: z.string().optional().describe("Path to config directory") },
    async (params) => ({
      content: [{ type: "text" as const, text: await handleValidate(params) }],
    }),
  );

  server.tool(
    "sdx_lint",
    "Run lint rules against the spec suite",
    {
      preset: z.string().optional().describe("Lint preset: minimal, recommended, strict"),
      specPath: z.string().optional().describe("Lint a specific spec file"),
    },
    async (params) => ({
      content: [{ type: "text" as const, text: await handleLint(params) }],
    }),
  );

  server.tool(
    "sdx_pack",
    "Pack spec context for LLM consumption within a token budget",
    {
      task: z.string().optional().describe("Task description for relevance scoring"),
      format: z.string().optional().describe("Output format: xml, markdown, json"),
      budget: z.number().optional().describe("Token budget (default: 12000)"),
    },
    async (params) => ({
      content: [{ type: "text" as const, text: await handlePack(params) }],
    }),
  );

  server.tool(
    "sdx_status",
    "Get spec suite health overview (lint health, staleness, integrity)",
    {},
    async () => ({
      content: [{ type: "text" as const, text: await handleStatus() }],
    }),
  );

  server.tool(
    "sdx_check",
    "Run spec-to-implementation drift analysis",
    {
      framework: z.string().optional().describe("Framework: express, hono, nextjs"),
      specId: z.string().optional().describe("Check a specific spec by ID"),
    },
    async (params) => ({
      content: [{ type: "text" as const, text: await handleCheck(params) }],
    }),
  );

  server.tool(
    "sdx_diff",
    "Show spec changes and downstream impact between git refs",
    {
      base: z.string().optional().describe("Base git ref (default: main)"),
      head: z.string().optional().describe("Head git ref (default: HEAD)"),
    },
    async (params) => ({
      content: [{ type: "text" as const, text: await handleDiff(params) }],
    }),
  );

  server.tool(
    "sdx_graph",
    "Get the spec dependency graph",
    {
      format: z.string().optional().describe("Output format: json (default) or dot"),
    },
    async (params) => ({
      content: [{ type: "text" as const, text: await handleGraph(params) }],
    }),
  );

  return server;
}
```

**IMPORTANT:** The `@modelcontextprotocol/sdk` uses `zod` for parameter schemas. Add `zod` as a dependency in `packages/mcp/package.json`. Check if zod is already available in the monorepo — if not, add it.

- [x] **Step 3: Update index.ts**

```typescript
export { createMcpServer } from "./server.js";
```

- [x] **Step 4: Run tests**

```bash
pnpm --filter @specdx/mcp test
```

- [x] **Step 5: Commit**

```bash
git add packages/mcp/src/
git commit -m "feat(mcp): create MCP server with 7 tools"
```

---

## Task 4: CLI Command

Create `sdx mcp` command that starts the MCP server on stdio.

**Files:**
- Create: `packages/cli/src/commands/mcp.ts`
- Modify: `packages/cli/src/main.ts`
- Modify: `packages/cli/tsup.config.ts`
- Modify: `packages/cli/package.json`

- [x] **Step 1: Add @specdx/mcp to CLI dependencies**

In `packages/cli/package.json`, add `"@specdx/mcp": "workspace:*"` to `devDependencies`.

- [x] **Step 2: Update tsup.config.ts**

Add `"@specdx/mcp"` to both `noExternal` arrays. Add `"@modelcontextprotocol/sdk"` and `"zod"` to both `external` arrays.

- [x] **Step 3: Create mcp command**

`packages/cli/src/commands/mcp.ts`:

```typescript
import { defineCommand } from "citty";

export default defineCommand({
  meta: { name: "mcp", description: "Start the specdx MCP server (stdio transport)" },
  args: {},
  async run() {
    const { createMcpServer } = await import("@specdx/mcp");
    const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");

    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
  },
});
```

- [x] **Step 4: Register in main.ts**

Add to subCommands: `mcp: () => import("./commands/mcp.js").then((m) => m.default),`

- [x] **Step 5: Build and test**

```bash
pnpm install && pnpm build && pnpm --filter specdx test
```

- [x] **Step 6: Commit**

```bash
git add packages/cli/
git commit -m "feat(cli): add sdx mcp command to start MCP server"
```

---

## Task 5: Final Integration

- [x] **Step 1: Build all packages**

```bash
pnpm build
```

- [x] **Step 2: Run full test suite**

```bash
pnpm test
```

- [x] **Step 3: Typecheck and lint**

```bash
pnpm typecheck && pnpm lint:code
```

- [x] **Step 4: Smoke test MCP server**

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | node packages/cli/dist/main.js mcp
```

This should return a JSON-RPC response with server capabilities. The server will hang waiting for more input — that's expected (it's a stdio server). Kill with Ctrl-C.

- [x] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "feat: complete Phase 4 Slice 5 — MCP server"
```

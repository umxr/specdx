# Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a usable `sdx init`, `sdx lint`, `sdx graph`, and `sdx validate` with structural validation, establishing the schema, spec file format, and config structure.

**Architecture:** TypeScript monorepo (Turborepo + pnpm workspaces) with 4 core packages for Phase 1: `@sdx/schema` (JSON Schema definitions + types + validators), `@sdx/core` (config loader, spec parser, dependency graph, utilities), `@sdx/lint` (linting engine + built-in rules), `@sdx/cli` (unified CLI). Packages build bottom-up: schema → core → lint → cli.

**Tech Stack:** TypeScript 5.7+, Turborepo, pnpm, Vitest, AJV 8, citty (CLI), gray-matter (frontmatter), unified/remark (markdown AST), yaml (YAML parsing), tinyglobby (glob), js-tiktoken (tokens), consola (logging)

**Spec:** `/Users/umar/Desktop/Work/sdx/roadmap.md` (Phase 1, lines 177-278)

---

## File Structure

```
sdx/
├── package.json                         # root workspace, private
├── pnpm-workspace.yaml                  # packages: ["packages/*"]
├── turbo.json                           # build/test/lint/typecheck tasks
├── tsconfig.base.json                   # shared compiler options
├── tsconfig.json                        # root references for editor support
├── vitest.shared.ts                     # shared vitest config
├── .gitignore
├── .npmrc
├── eslint.config.js                     # ESLint flat config (Task 16)
├── .prettierrc                          # Prettier config (Task 16)
├── .changeset/                          # Changesets config (Task 17)
│   └── config.json
├── .github/                             # CI/CD (Task 18)
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
├── spec.config.yaml                     # sdx's own spec suite (Task 15)
├── specs/                               # sdx's own specs (Task 15)
├── templates/                           # init templates (Task 14)
│   ├── lightweight/
│   │   ├── spec.config.yaml
│   │   ├── prd.md
│   │   └── technical-design.md
│   ├── bmad/
│   │   ├── spec.config.yaml
│   │   ├── prd.md
│   │   ├── technical-design.md
│   │   ├── stories/
│   │   │   └── .gitkeep
│   │   ├── test-plan.md
│   │   └── adr/
│   │       └── .gitkeep
│   └── api-first/
│       ├── spec.config.yaml
│       ├── technical-design.md
│       ├── api-contract.md
│       └── test-plan.md
├── packages/
│   ├── schema/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── index.ts                 # public exports
│   │       ├── schemas/                 # JSON Schema files (source of truth)
│   │       │   ├── base-spec.json       # shared frontmatter fields
│   │       │   ├── config.json          # spec.config.yaml schema
│   │       │   ├── prd.json
│   │       │   ├── technical-design.json
│   │       │   ├── user-story.json
│   │       │   ├── test-plan.json
│   │       │   ├── adr.json
│   │       │   └── api-contract.json
│   │       ├── types.ts                 # hand-written TS types matching schemas
│   │       ├── validator.ts             # AJV setup + compiled validators
│   │       └── sections.ts              # required sections per spec type
│   ├── core/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── index.ts
│   │       ├── config.ts               # config loader (parse + validate spec.config.yaml)
│   │       ├── parser.ts               # spec parser (markdown, YAML, OpenAPI)
│   │       ├── graph.ts                # dependency graph builder (DAG, cycle detection, topo sort)
│   │       ├── glob.ts                 # glob resolver for spec paths
│   │       ├── tokens.ts              # token counter
│   │       └── logger.ts               # structured levelled logger
│   ├── lint/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── index.ts
│   │       ├── engine.ts               # lint engine: load rules, run, collect diagnostics
│   │       ├── types.ts                # LintRule, LintContext, Diagnostic, Severity
│   │       ├── presets.ts              # minimal, recommended, strict
│   │       ├── rules/
│   │       │   ├── index.ts            # all built-in rules registry
│   │       │   ├── valid-frontmatter.ts
│   │       │   ├── required-sections.ts
│   │       │   ├── valid-references.ts
│   │       │   ├── no-circular-deps.ts
│   │       │   ├── story-coverage.ts
│   │       │   ├── staleness-check.ts
│   │       │   └── no-vague-language.ts
│   │       └── custom-rule-loader.ts   # load custom rules from file paths
│   ├── cli/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── src/
│   │       ├── main.ts                 # root command + runMain
│   │       ├── shared-args.ts          # verbose, quiet, format
│   │       ├── commands/
│   │       │   ├── init.ts
│   │       │   ├── lint.ts
│   │       │   ├── validate.ts
│   │       │   └── graph.ts
│   │       └── formatters/
│   │           ├── pretty.ts           # coloured terminal output
│   │           ├── json.ts             # JSON output
│   │           └── github.ts           # GitHub Actions annotations
│   ├── pack/                            # Phase 2 — empty placeholder
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts
│   ├── diff/                            # Phase 3 — empty placeholder
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts
│   ├── github-action/                   # Phase 3 — empty placeholder
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   │       └── index.ts
│   └── skills/                          # Phase 2 — empty placeholder
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           └── index.ts
```

**Parallelization notes for subagent execution:**
- Task 1 (infrastructure) must complete first — everything depends on it
- Tasks 2-4 (schema) are sequential: schemas → types → validator
- Tasks 5, 6, 7, 8 (core) can partially parallelize: config (5) and graph (7) are independent; parser (6) depends on config; utilities (8) are independent
- Tasks 9, 10, 11 (lint) are sequential: engine → structure rules → content rules + presets
- Tasks 12, 13, 14 (cli + templates) can partially parallelize after lint is done
- Task 15 (dogfooding + docs) depends on everything
- Tasks 16, 17, 18 (ESLint, changesets, CI) are independent of each other and can run in parallel after Task 1

---

## Task 1: Monorepo Infrastructure

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `tsconfig.base.json`, `tsconfig.json`, `vitest.shared.ts`, `.gitignore`, `.npmrc`
- Create: `packages/*/package.json`, `packages/*/tsconfig.json`, `packages/*/vitest.config.ts`, `packages/*/src/index.ts`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "sdx",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "clean": "turbo run clean"
  },
  "devDependencies": {
    "turbo": "^2.4.0",
    "typescript": "^5.7.0",
    "vitest": "^3.2.0",
    "@types/node": "^22.0.0"
  }
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "packages/*"
```

- [ ] **Step 3: Create turbo.json**

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"],
      "inputs": ["src/**/*.ts", "tsconfig.json", "package.json"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "outputs": []
    },
    "test": {
      "dependsOn": ["^build"],
      "outputs": ["coverage/**"],
      "inputs": ["src/**/*.ts", "test/**/*.ts", "vitest.config.ts"]
    },
    "clean": {
      "cache": false
    }
  },
  "globalDependencies": ["tsconfig.base.json"]
}
```

- [ ] **Step 4: Create tsconfig.base.json**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

- [ ] **Step 5: Create tsconfig.json (root references)**

```json
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": { "noEmit": true },
  "references": [
    { "path": "packages/schema" },
    { "path": "packages/core" },
    { "path": "packages/lint" },
    { "path": "packages/cli" },
    { "path": "packages/pack" },
    { "path": "packages/diff" },
    { "path": "packages/github-action" },
    { "path": "packages/skills" }
  ]
}
```

- [ ] **Step 6: Create vitest.shared.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/**/index.ts"],
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    passWithNoTests: true,
  },
});
```

- [ ] **Step 7: Create .gitignore**

```
node_modules/
dist/
coverage/
.turbo/
*.tsbuildinfo
```

- [ ] **Step 8: Create .npmrc**

```
shamefully-hoist=false
strict-peer-dependencies=true
```

- [ ] **Step 9: Create @sdx/schema package scaffold**

`packages/schema/package.json`:
```json
{
  "name": "@sdx/schema",
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc --build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist .turbo *.tsbuildinfo"
  },
  "dependencies": {
    "ajv": "^8.18.0",
    "ajv-formats": "^3.0.1"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

`packages/schema/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

`packages/schema/vitest.config.ts`:
```typescript
import { defineConfig, mergeConfig } from "vitest/config";
import sharedConfig from "../../vitest.shared.js";

export default mergeConfig(sharedConfig, defineConfig({}));
```

`packages/schema/src/index.ts`:
```typescript
export {};
```

- [ ] **Step 10: Create @sdx/core package scaffold**

`packages/core/package.json`:
```json
{
  "name": "@sdx/core",
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc --build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist .turbo *.tsbuildinfo"
  },
  "dependencies": {
    "@sdx/schema": "workspace:*",
    "gray-matter": "^4.0.3",
    "yaml": "^2.7.0",
    "unified": "^11.0.0",
    "remark-parse": "^11.0.0",
    "unist-util-visit": "^5.0.0",
    "tinyglobby": "^0.2.12",
    "js-tiktoken": "^1.0.18",
    "consola": "^3.4.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

`packages/core/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"],
  "references": [
    { "path": "../schema" }
  ]
}
```

`packages/core/vitest.config.ts`: (same pattern as schema)

`packages/core/src/index.ts`:
```typescript
export {};
```

- [ ] **Step 11: Create @sdx/lint package scaffold**

`packages/lint/package.json`:
```json
{
  "name": "@sdx/lint",
  "version": "0.0.0",
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc --build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist .turbo *.tsbuildinfo"
  },
  "dependencies": {
    "@sdx/schema": "workspace:*",
    "@sdx/core": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

`packages/lint/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"],
  "references": [
    { "path": "../schema" },
    { "path": "../core" }
  ]
}
```

- [ ] **Step 12: Create @sdx/cli package scaffold**

`packages/cli/package.json`:
```json
{
  "name": "sdx",
  "version": "0.0.0",
  "type": "module",
  "bin": {
    "sdx": "./dist/main.js"
  },
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc --build",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "clean": "rm -rf dist .turbo *.tsbuildinfo"
  },
  "dependencies": {
    "@sdx/schema": "workspace:*",
    "@sdx/core": "workspace:*",
    "@sdx/lint": "workspace:*",
    "citty": "^0.2.1",
    "consola": "^3.4.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0"
  }
}
```

`packages/cli/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"],
  "references": [
    { "path": "../schema" },
    { "path": "../core" },
    { "path": "../lint" }
  ]
}
```

- [ ] **Step 13: Create placeholder packages (pack, diff, github-action, skills)**

Each gets the same scaffold pattern: `package.json` (name only, no deps beyond typescript), `tsconfig.json` (no references), `vitest.config.ts`, `src/index.ts` with `export {}`.

Package names: `@sdx/pack`, `@sdx/diff`, `@sdx/action`, `@sdx/skills`

- [ ] **Step 14: Install dependencies and verify build**

Run: `pnpm install && pnpm build && pnpm test`
Expected: All packages build and test successfully (tests pass with no tests).

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "chore: scaffold monorepo with turborepo, pnpm workspaces, and 8 packages"
```

---

## Task 2: @sdx/schema — JSON Schema Definitions

**Files:**
- Create: `packages/schema/src/schemas/base-spec.json`
- Create: `packages/schema/src/schemas/config.json`
- Create: `packages/schema/src/schemas/prd.json`
- Create: `packages/schema/src/schemas/technical-design.json`
- Create: `packages/schema/src/schemas/user-story.json`
- Create: `packages/schema/src/schemas/test-plan.json`
- Create: `packages/schema/src/schemas/adr.json`
- Create: `packages/schema/src/schemas/api-contract.json`
- Test: `packages/schema/src/schemas.test.ts`

- [ ] **Step 1: Write test for base spec schema**

`packages/schema/src/schemas.test.ts`:
```typescript
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { describe, it, expect } from "vitest";
import baseSpecSchema from "./schemas/base-spec.json";

function createAjv() {
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv, ["date"]);
  return ajv;
}

describe("base-spec schema", () => {
  const ajv = createAjv();
  const validate = ajv.compile(baseSpecSchema);

  it("accepts valid base frontmatter", () => {
    const valid = validate({
      id: "prd-001",
      type: "prd",
      title: "User Auth System",
      status: "draft",
      version: "1.0",
      created: "2026-01-15",
      updated: "2026-02-01",
      authors: ["umar"],
      tags: ["auth"],
      references: [{ id: "tech-001", relationship: "implemented-by" }],
    });
    expect(valid).toBe(true);
  });

  it("rejects missing required fields", () => {
    const valid = validate({ title: "Incomplete" });
    expect(valid).toBe(false);
    const missing = validate.errors?.map((e) => e.params.missingProperty);
    expect(missing).toContain("id");
    expect(missing).toContain("type");
    expect(missing).toContain("status");
  });

  it("rejects invalid status enum", () => {
    const valid = validate({
      id: "x",
      type: "prd",
      title: "X",
      status: "invalid",
      version: "1.0",
      created: "2026-01-01",
      authors: ["a"],
    });
    expect(valid).toBe(false);
  });

  it("accepts minimal valid frontmatter (only required fields)", () => {
    const valid = validate({
      id: "x-001",
      type: "prd",
      title: "Minimal",
      status: "draft",
      version: "1.0",
      created: "2026-01-01",
      authors: ["dev"],
    });
    expect(valid).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/schema && pnpm test`
Expected: FAIL — schema files don't exist yet

- [ ] **Step 3: Create base-spec.json schema**

`packages/schema/src/schemas/base-spec.json`:
```json
{
  "$id": "base-spec",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": { "type": "string", "minLength": 1 },
    "type": {
      "type": "string",
      "enum": ["prd", "technical-design", "user-story", "test-plan", "adr", "api-contract"]
    },
    "title": { "type": "string", "minLength": 1 },
    "status": {
      "type": "string",
      "enum": ["draft", "review", "approved", "superseded"]
    },
    "version": { "type": "string" },
    "created": { "type": "string", "format": "date" },
    "updated": { "type": "string", "format": "date" },
    "authors": {
      "type": "array",
      "items": { "type": "string" },
      "minItems": 1
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "default": []
    },
    "references": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string" },
          "relationship": {
            "type": "string",
            "enum": ["implemented-by", "decomposed-into", "depends-on", "supersedes", "related-to"]
          }
        },
        "required": ["id", "relationship"],
        "additionalProperties": false
      },
      "default": []
    }
  },
  "required": ["id", "type", "title", "status", "version", "created", "authors"],
  "additionalProperties": true
}
```

Note: `additionalProperties: true` on base so spec-type schemas can add their own fields.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/schema && pnpm test`
Expected: PASS — all 4 base-spec tests pass

- [ ] **Step 5: Write tests for spec-type schemas**

Add to `packages/schema/src/schemas.test.ts`:

```typescript
import prdSchema from "./schemas/prd.json";
import technicalDesignSchema from "./schemas/technical-design.json";
import userStorySchema from "./schemas/user-story.json";
import testPlanSchema from "./schemas/test-plan.json";
import adrSchema from "./schemas/adr.json";
import apiContractSchema from "./schemas/api-contract.json";

describe("spec type schemas", () => {
  const ajv = createAjv();
  ajv.addSchema(baseSpecSchema);

  it("PRD schema validates a well-formed PRD", () => {
    const validate = ajv.compile(prdSchema);
    const valid = validate({
      id: "prd-001",
      type: "prd",
      title: "Auth System",
      status: "approved",
      version: "1.0",
      created: "2026-01-15",
      authors: ["umar"],
    });
    expect(valid).toBe(true);
  });

  it("PRD schema rejects wrong type field", () => {
    const validate = ajv.compile(prdSchema);
    const valid = validate({
      id: "prd-001",
      type: "adr",
      title: "Auth System",
      status: "approved",
      version: "1.0",
      created: "2026-01-15",
      authors: ["umar"],
    });
    expect(valid).toBe(false);
  });

  it("user-story schema requires story_id, priority, estimate", () => {
    const validate = ajv.compile(userStorySchema);
    const valid = validate({
      id: "story-001",
      type: "user-story",
      title: "Login flow",
      status: "draft",
      version: "1.0",
      created: "2026-01-15",
      authors: ["umar"],
      story_id: "US-001",
      priority: "high",
      estimate: "3",
    });
    expect(valid).toBe(true);
  });

  it("user-story schema rejects missing story_id", () => {
    const validate = ajv.compile(userStorySchema);
    const valid = validate({
      id: "story-001",
      type: "user-story",
      title: "Login",
      status: "draft",
      version: "1.0",
      created: "2026-01-15",
      authors: ["umar"],
    });
    expect(valid).toBe(false);
  });

  it("ADR schema validates a well-formed ADR", () => {
    const validate = ajv.compile(adrSchema);
    const valid = validate({
      id: "adr-001",
      type: "adr",
      title: "Use PostgreSQL",
      status: "approved",
      version: "1.0",
      created: "2026-01-15",
      authors: ["umar"],
    });
    expect(valid).toBe(true);
  });

  it("technical-design schema validates correctly", () => {
    const validate = ajv.compile(technicalDesignSchema);
    const valid = validate({
      id: "tech-001",
      type: "technical-design",
      title: "Auth Architecture",
      status: "review",
      version: "1.0",
      created: "2026-01-15",
      authors: ["umar"],
    });
    expect(valid).toBe(true);
  });

  it("test-plan schema validates correctly", () => {
    const validate = ajv.compile(testPlanSchema);
    const valid = validate({
      id: "tp-001",
      type: "test-plan",
      title: "Auth Test Plan",
      status: "draft",
      version: "1.0",
      created: "2026-01-15",
      authors: ["umar"],
    });
    expect(valid).toBe(true);
  });

  it("api-contract schema validates correctly", () => {
    const validate = ajv.compile(apiContractSchema);
    const valid = validate({
      id: "api-001",
      type: "api-contract",
      title: "Auth API",
      status: "draft",
      version: "1.0",
      created: "2026-01-15",
      authors: ["umar"],
    });
    expect(valid).toBe(true);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `cd packages/schema && pnpm test`
Expected: FAIL — spec type schema files don't exist

- [ ] **Step 7: Create all spec-type schemas**

Each spec type schema uses `allOf` to extend the base and adds a `const` constraint on `type`.

`packages/schema/src/schemas/prd.json`:
```json
{
  "$id": "prd",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "allOf": [
    { "$ref": "base-spec" },
    {
      "type": "object",
      "properties": {
        "type": { "const": "prd" }
      },
      "required": ["type"]
    }
  ]
}
```

`packages/schema/src/schemas/technical-design.json`:
```json
{
  "$id": "technical-design",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "allOf": [
    { "$ref": "base-spec" },
    {
      "type": "object",
      "properties": {
        "type": { "const": "technical-design" }
      },
      "required": ["type"]
    }
  ]
}
```

`packages/schema/src/schemas/user-story.json`:
```json
{
  "$id": "user-story",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "allOf": [
    { "$ref": "base-spec" },
    {
      "type": "object",
      "properties": {
        "type": { "const": "user-story" },
        "story_id": { "type": "string", "minLength": 1 },
        "priority": {
          "type": "string",
          "enum": ["critical", "high", "medium", "low"]
        },
        "estimate": { "type": "string" }
      },
      "required": ["type", "story_id", "priority", "estimate"]
    }
  ]
}
```

`packages/schema/src/schemas/test-plan.json`:
```json
{
  "$id": "test-plan",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "allOf": [
    { "$ref": "base-spec" },
    {
      "type": "object",
      "properties": {
        "type": { "const": "test-plan" }
      },
      "required": ["type"]
    }
  ]
}
```

`packages/schema/src/schemas/adr.json`:
```json
{
  "$id": "adr",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "allOf": [
    { "$ref": "base-spec" },
    {
      "type": "object",
      "properties": {
        "type": { "const": "adr" }
      },
      "required": ["type"]
    }
  ]
}
```

`packages/schema/src/schemas/api-contract.json`:
```json
{
  "$id": "api-contract",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "allOf": [
    { "$ref": "base-spec" },
    {
      "type": "object",
      "properties": {
        "type": { "const": "api-contract" }
      },
      "required": ["type"]
    }
  ]
}
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd packages/schema && pnpm test`
Expected: PASS — all spec type schema tests pass

- [ ] **Step 9: Write test for config schema**

Add to `packages/schema/src/schemas.test.ts`:

```typescript
import configSchema from "./schemas/config.json";

describe("config schema", () => {
  const ajv = createAjv();
  const validate = ajv.compile(configSchema);

  it("accepts a valid spec.config.yaml structure", () => {
    const valid = validate({
      version: "1.0",
      project: { name: "my-project", description: "test" },
      specs: {
        prd: { path: "specs/prd.md", type: "prd", required: true },
        stories: { path: "specs/stories/*.md", type: "user-story", requires: ["prd"] },
      },
      lint: { extends: "recommended", rules: {}, ignore: [] },
    });
    expect(valid).toBe(true);
  });

  it("requires version field", () => {
    const valid = validate({ specs: {} });
    expect(valid).toBe(false);
  });

  it("requires specs field", () => {
    const valid = validate({ version: "1.0" });
    expect(valid).toBe(false);
  });

  it("validates spec entry structure", () => {
    const valid = validate({
      version: "1.0",
      specs: {
        prd: { path: "specs/prd.md", type: "prd" },
      },
    });
    expect(valid).toBe(true);
  });
});
```

- [ ] **Step 10: Create config.json schema**

`packages/schema/src/schemas/config.json`:
```json
{
  "$id": "sdx-config",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "version": { "type": "string" },
    "project": {
      "type": "object",
      "properties": {
        "name": { "type": "string" },
        "description": { "type": "string" }
      },
      "additionalProperties": false
    },
    "specs": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "path": { "type": "string" },
          "type": {
            "type": "string",
            "enum": ["prd", "technical-design", "user-story", "test-plan", "adr", "api-contract"]
          },
          "required": { "type": "boolean", "default": false },
          "requires": {
            "type": "array",
            "items": { "type": "string" }
          }
        },
        "required": ["path", "type"],
        "additionalProperties": false
      }
    },
    "lint": {
      "type": "object",
      "properties": {
        "extends": { "type": "string", "enum": ["minimal", "recommended", "strict"] },
        "rules": { "type": "object" },
        "ignore": { "type": "array", "items": { "type": "string" } }
      },
      "additionalProperties": false
    },
    "pack": { "type": "object" },
    "diff": { "type": "object" },
    "ci": { "type": "object" }
  },
  "required": ["version", "specs"],
  "additionalProperties": false
}
```

- [ ] **Step 11: Run tests to verify they pass**

Run: `cd packages/schema && pnpm test`
Expected: PASS

- [ ] **Step 12: Commit**

```bash
git add packages/schema/src/schemas/ packages/schema/src/schemas.test.ts
git commit -m "feat(schema): add JSON Schema definitions for all spec types and config"
```

---

## Task 3: @sdx/schema — TypeScript Types

**Files:**
- Create: `packages/schema/src/types.ts`
- Create: `packages/schema/src/sections.ts`
- Test: `packages/schema/src/types.test.ts`

- [ ] **Step 1: Write test for types**

`packages/schema/src/types.test.ts`:
```typescript
import { describe, it, expect, expectTypeOf } from "vitest";
import type {
  BaseSpec,
  PrdSpec,
  UserStorySpec,
  AdrSpec,
  TechnicalDesignSpec,
  TestPlanSpec,
  ApiContractSpec,
  SpecType,
  SpecStatus,
  SpecReference,
  SdxConfig,
  SpecEntry,
} from "./types.js";
import { SPEC_TYPES, SPEC_STATUSES } from "./types.js";
import { REQUIRED_SECTIONS } from "./sections.js";

describe("types", () => {
  it("exports SPEC_TYPES constant matching the type union", () => {
    expect(SPEC_TYPES).toEqual([
      "prd",
      "technical-design",
      "user-story",
      "test-plan",
      "adr",
      "api-contract",
    ]);
  });

  it("exports SPEC_STATUSES constant", () => {
    expect(SPEC_STATUSES).toEqual(["draft", "review", "approved", "superseded"]);
  });

  it("BaseSpec has required fields", () => {
    const spec: BaseSpec = {
      id: "prd-001",
      type: "prd",
      title: "Test",
      status: "draft",
      version: "1.0",
      created: "2026-01-01",
      authors: ["dev"],
    };
    expect(spec.id).toBe("prd-001");
  });

  it("UserStorySpec requires story_id, priority, estimate", () => {
    const story: UserStorySpec = {
      id: "s-001",
      type: "user-story",
      title: "Login",
      status: "draft",
      version: "1.0",
      created: "2026-01-01",
      authors: ["dev"],
      story_id: "US-001",
      priority: "high",
      estimate: "3",
    };
    expect(story.story_id).toBe("US-001");
  });
});

describe("sections", () => {
  it("defines required sections for PRD", () => {
    expect(REQUIRED_SECTIONS["prd"]).toContain("Problem Statement");
    expect(REQUIRED_SECTIONS["prd"]).toContain("Goals");
    expect(REQUIRED_SECTIONS["prd"]).toContain("Features");
  });

  it("defines required sections for all spec types", () => {
    for (const type of ["prd", "technical-design", "user-story", "test-plan", "adr", "api-contract"]) {
      expect(REQUIRED_SECTIONS[type as SpecType]).toBeDefined();
      expect(REQUIRED_SECTIONS[type as SpecType]!.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/schema && pnpm test`
Expected: FAIL — types.ts and sections.ts don't exist

- [ ] **Step 3: Create types.ts**

`packages/schema/src/types.ts`:
```typescript
export const SPEC_TYPES = [
  "prd",
  "technical-design",
  "user-story",
  "test-plan",
  "adr",
  "api-contract",
] as const;

export type SpecType = (typeof SPEC_TYPES)[number];

export const SPEC_STATUSES = ["draft", "review", "approved", "superseded"] as const;
export type SpecStatus = (typeof SPEC_STATUSES)[number];

export interface SpecReference {
  id: string;
  relationship:
    | "implemented-by"
    | "decomposed-into"
    | "depends-on"
    | "supersedes"
    | "related-to";
}

export interface BaseSpec {
  id: string;
  type: SpecType;
  title: string;
  status: SpecStatus;
  version: string;
  created: string;
  updated?: string;
  authors: string[];
  tags?: string[];
  references?: SpecReference[];
}

export interface PrdSpec extends BaseSpec {
  type: "prd";
}

export interface TechnicalDesignSpec extends BaseSpec {
  type: "technical-design";
}

export interface UserStorySpec extends BaseSpec {
  type: "user-story";
  story_id: string;
  priority: "critical" | "high" | "medium" | "low";
  estimate: string;
}

export interface TestPlanSpec extends BaseSpec {
  type: "test-plan";
}

export interface AdrSpec extends BaseSpec {
  type: "adr";
}

export interface ApiContractSpec extends BaseSpec {
  type: "api-contract";
}

export type Spec =
  | PrdSpec
  | TechnicalDesignSpec
  | UserStorySpec
  | TestPlanSpec
  | AdrSpec
  | ApiContractSpec;

export interface SpecEntry {
  path: string;
  type: SpecType;
  required?: boolean;
  requires?: string[];
}

export interface SdxConfig {
  version: string;
  project?: {
    name?: string;
    description?: string;
  };
  specs: Record<string, SpecEntry>;
  lint?: {
    extends?: "minimal" | "recommended" | "strict";
    rules?: Record<string, unknown>;
    ignore?: string[];
  };
  pack?: Record<string, unknown>;
  diff?: Record<string, unknown>;
  ci?: Record<string, unknown>;
}
```

- [ ] **Step 4: Create sections.ts**

`packages/schema/src/sections.ts`:
```typescript
import type { SpecType } from "./types.js";

export const REQUIRED_SECTIONS: Record<SpecType, string[]> = {
  prd: ["Problem Statement", "Goals", "Non-Goals", "Features", "Success Criteria"],
  "technical-design": [
    "Overview",
    "Architecture",
    "Data Model",
    "API Design",
    "Dependencies",
    "Risks",
    "Open Questions",
  ],
  "user-story": ["Description", "Acceptance Criteria", "Dependencies", "Notes"],
  "test-plan": ["Scope", "Test Cases", "Coverage Matrix", "Edge Cases"],
  adr: ["Context", "Decision", "Status", "Consequences"],
  "api-contract": ["Endpoints", "Request/Response Schemas", "Auth", "Error Codes"],
};
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/schema && pnpm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/schema/src/types.ts packages/schema/src/sections.ts packages/schema/src/types.test.ts
git commit -m "feat(schema): add TypeScript types and required sections definitions"
```

---

## Task 4: @sdx/schema — Validator & Public Exports

**Files:**
- Create: `packages/schema/src/validator.ts`
- Modify: `packages/schema/src/index.ts`
- Test: `packages/schema/src/validator.test.ts`

- [ ] **Step 1: Write test for validator**

`packages/schema/src/validator.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { validateSpec, validateConfig, ValidationResult } from "./validator.js";

describe("validateSpec", () => {
  it("validates a correct PRD frontmatter", () => {
    const result = validateSpec("prd", {
      id: "prd-001",
      type: "prd",
      title: "Auth System",
      status: "draft",
      version: "1.0",
      created: "2026-01-15",
      authors: ["umar"],
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toBeNull();
  });

  it("rejects invalid frontmatter with descriptive errors", () => {
    const result = validateSpec("prd", { title: "Incomplete" });
    expect(result.valid).toBe(false);
    expect(result.errors).not.toBeNull();
    expect(result.errors!.length).toBeGreaterThan(0);
  });

  it("rejects unknown spec type", () => {
    const result = validateSpec("unknown" as any, {});
    expect(result.valid).toBe(false);
    expect(result.errors![0]!.message).toContain("Unknown spec type");
  });
});

describe("validateConfig", () => {
  it("validates a correct config", () => {
    const result = validateConfig({
      version: "1.0",
      specs: {
        prd: { path: "specs/prd.md", type: "prd" },
      },
    });
    expect(result.valid).toBe(true);
  });

  it("rejects config missing version", () => {
    const result = validateConfig({ specs: {} });
    expect(result.valid).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/schema && pnpm test`
Expected: FAIL

- [ ] **Step 3: Create validator.ts**

`packages/schema/src/validator.ts`:
```typescript
import Ajv, { type ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import type { SpecType } from "./types.js";

import baseSpecSchema from "./schemas/base-spec.json";
import configSchema from "./schemas/config.json";
import prdSchema from "./schemas/prd.json";
import technicalDesignSchema from "./schemas/technical-design.json";
import userStorySchema from "./schemas/user-story.json";
import testPlanSchema from "./schemas/test-plan.json";
import adrSchema from "./schemas/adr.json";
import apiContractSchema from "./schemas/api-contract.json";

export interface ValidationResult {
  valid: boolean;
  errors: ErrorObject[] | null;
}

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv, ["date"]);

ajv.addSchema(baseSpecSchema);

const specValidators: Record<string, ReturnType<typeof ajv.compile>> = {
  prd: ajv.compile(prdSchema),
  "technical-design": ajv.compile(technicalDesignSchema),
  "user-story": ajv.compile(userStorySchema),
  "test-plan": ajv.compile(testPlanSchema),
  adr: ajv.compile(adrSchema),
  "api-contract": ajv.compile(apiContractSchema),
};

const configValidator = ajv.compile(configSchema);

export function validateSpec(
  type: SpecType,
  data: Record<string, unknown>,
): ValidationResult {
  const validate = specValidators[type];
  if (!validate) {
    return {
      valid: false,
      errors: [{ message: `Unknown spec type: "${type}"` } as ErrorObject],
    };
  }
  const valid = validate(data);
  return { valid: !!valid, errors: valid ? null : (validate.errors ?? null) };
}

export function validateConfig(
  data: Record<string, unknown>,
): ValidationResult {
  const valid = configValidator(data);
  return { valid: !!valid, errors: valid ? null : (configValidator.errors ?? null) };
}
```

- [ ] **Step 4: Update index.ts with public exports**

`packages/schema/src/index.ts`:
```typescript
export {
  type BaseSpec,
  type PrdSpec,
  type TechnicalDesignSpec,
  type UserStorySpec,
  type TestPlanSpec,
  type AdrSpec,
  type ApiContractSpec,
  type Spec,
  type SpecType,
  type SpecStatus,
  type SpecReference,
  type SdxConfig,
  type SpecEntry,
  SPEC_TYPES,
  SPEC_STATUSES,
} from "./types.js";

export { REQUIRED_SECTIONS } from "./sections.js";

export { validateSpec, validateConfig, type ValidationResult } from "./validator.js";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/schema && pnpm test`
Expected: PASS — all schema, types, and validator tests pass

- [ ] **Step 6: Build the package to verify exports compile**

Run: `cd packages/schema && pnpm build`
Expected: Build succeeds, `dist/` contains compiled JS + declarations

- [ ] **Step 7: Commit**

```bash
git add packages/schema/src/
git commit -m "feat(schema): add AJV validator and public exports"
```

---

## Task 5: @sdx/core — Config Loader

**Files:**
- Create: `packages/core/src/config.ts`
- Create: `packages/core/test/fixtures/valid-config.yaml`
- Create: `packages/core/test/fixtures/invalid-config.yaml`
- Test: `packages/core/src/config.test.ts`

- [ ] **Step 1: Create test fixtures**

`packages/core/test/fixtures/valid-config.yaml`:
```yaml
version: "1.0"

project:
  name: "test-project"
  description: "A test project"

specs:
  prd:
    path: "specs/prd.md"
    type: "prd"
    required: true
  technical:
    path: "specs/technical-design.md"
    type: "technical-design"
    requires: ["prd"]
  stories:
    path: "specs/stories/*.md"
    type: "user-story"
    requires: ["prd"]

lint:
  extends: "recommended"
  rules: {}
```

`packages/core/test/fixtures/invalid-config.yaml`:
```yaml
specs:
  prd:
    path: "specs/prd.md"
```

- [ ] **Step 2: Write test for config loader**

`packages/core/src/config.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { loadConfig, ConfigError } from "./config.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../test/fixtures");

describe("loadConfig", () => {
  it("loads and validates a correct config file", async () => {
    const config = await loadConfig(join(fixturesDir, "valid-config.yaml"));
    expect(config.version).toBe("1.0");
    expect(config.project?.name).toBe("test-project");
    expect(config.specs.prd.type).toBe("prd");
    expect(config.specs.technical.requires).toEqual(["prd"]);
  });

  it("throws ConfigError for invalid config", async () => {
    await expect(
      loadConfig(join(fixturesDir, "invalid-config.yaml")),
    ).rejects.toThrow(ConfigError);
  });

  it("throws ConfigError for missing file", async () => {
    await expect(loadConfig("/nonexistent/spec.config.yaml")).rejects.toThrow(
      ConfigError,
    );
  });

  it("finds config by walking up from a given directory", async () => {
    const config = await loadConfig(undefined, fixturesDir);
    // Should find the valid-config.yaml or throw if none found
    // This tests the discovery mechanism
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/core && pnpm build && pnpm test`
Expected: FAIL

- [ ] **Step 4: Implement config loader**

`packages/core/src/config.ts`:
```typescript
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { parse as parseYaml } from "yaml";
import { validateConfig, type SdxConfig } from "@sdx/schema";

export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly errors?: unknown[],
  ) {
    super(message);
    this.name = "ConfigError";
  }
}

const CONFIG_FILENAME = "spec.config.yaml";

export async function loadConfig(
  filePath?: string,
  searchFrom?: string,
): Promise<SdxConfig> {
  const resolvedPath = filePath ?? (await findConfig(searchFrom ?? process.cwd()));
  if (!resolvedPath) {
    throw new ConfigError(
      `No ${CONFIG_FILENAME} found. Run 'sdx init' to create one.`,
    );
  }

  let raw: string;
  try {
    raw = await readFile(resolvedPath, "utf-8");
  } catch {
    throw new ConfigError(`Cannot read config file: ${resolvedPath}`);
  }

  let data: Record<string, unknown>;
  try {
    data = parseYaml(raw) as Record<string, unknown>;
  } catch (err) {
    throw new ConfigError(
      `Invalid YAML in ${resolvedPath}: ${(err as Error).message}`,
    );
  }

  const result = validateConfig(data);
  if (!result.valid) {
    throw new ConfigError(
      `Invalid config in ${resolvedPath}`,
      result.errors ?? undefined,
    );
  }

  return data as unknown as SdxConfig;
}

async function findConfig(from: string): Promise<string | undefined> {
  let dir = from;
  const root = dirname(dir) === dir ? dir : undefined;

  while (true) {
    const candidate = join(dir, CONFIG_FILENAME);
    try {
      await readFile(candidate, "utf-8");
      return candidate;
    } catch {
      const parent = dirname(dir);
      if (parent === dir) return undefined;
      dir = parent;
    }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm build --filter=@sdx/schema && cd packages/core && pnpm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/config.ts packages/core/src/config.test.ts packages/core/test/
git commit -m "feat(core): add config loader with YAML parsing and schema validation"
```

---

## Task 6: @sdx/core — Spec Parser

**Files:**
- Create: `packages/core/src/parser.ts`
- Create: `packages/core/test/fixtures/specs/prd.md`
- Create: `packages/core/test/fixtures/specs/story.yaml`
- Test: `packages/core/src/parser.test.ts`

- [ ] **Step 1: Create test fixtures**

`packages/core/test/fixtures/specs/prd.md`:
```markdown
---
id: "prd-001"
type: "prd"
title: "User Authentication System"
status: "approved"
version: "1.2"
created: "2026-02-15"
updated: "2026-03-10"
authors: ["umar"]
tags: ["auth", "security"]
references:
  - id: "tech-001"
    relationship: "implemented-by"
---

# User Authentication System

## Problem Statement

Users need a secure way to authenticate.

## Goals

- Secure login flow
- OAuth support

## Non-Goals

- Biometric authentication

## Features

- **F1**: Email/password login
- **F2**: OAuth (Google, GitHub)

## Success Criteria

- 99.9% uptime on auth service
```

`packages/core/test/fixtures/specs/story.yaml`:
```yaml
id: "story-001"
type: "user-story"
title: "Login with email"
status: "draft"
version: "1.0"
created: "2026-02-20"
authors: ["umar"]
story_id: "US-001"
priority: "high"
estimate: "3"
description: "As a user, I want to log in with my email and password."
acceptance_criteria:
  - "User can enter email and password"
  - "Invalid credentials show error message"
```

- [ ] **Step 2: Write test for spec parser**

`packages/core/src/parser.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { parseSpec, ParseError } from "./parser.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../test/fixtures/specs");

describe("parseSpec", () => {
  it("parses a markdown spec with frontmatter", async () => {
    const spec = await parseSpec(join(fixturesDir, "prd.md"));
    expect(spec.frontmatter.id).toBe("prd-001");
    expect(spec.frontmatter.type).toBe("prd");
    expect(spec.frontmatter.title).toBe("User Authentication System");
    expect(spec.content).toContain("## Problem Statement");
    expect(spec.sections).toContain("Problem Statement");
    expect(spec.sections).toContain("Goals");
    expect(spec.sections).toContain("Features");
    expect(spec.filePath).toContain("prd.md");
  });

  it("parses a pure YAML spec", async () => {
    const spec = await parseSpec(join(fixturesDir, "story.yaml"));
    expect(spec.frontmatter.id).toBe("story-001");
    expect(spec.frontmatter.type).toBe("user-story");
    expect(spec.frontmatter.story_id).toBe("US-001");
    expect(spec.sections).toEqual([]);
    expect(spec.content).toBe("");
  });

  it("validates frontmatter against schema", async () => {
    const spec = await parseSpec(join(fixturesDir, "prd.md"));
    expect(spec.valid).toBe(true);
    expect(spec.validationErrors).toBeNull();
  });

  it("throws ParseError for nonexistent file", async () => {
    await expect(parseSpec("/nonexistent.md")).rejects.toThrow(ParseError);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/core && pnpm test`
Expected: FAIL

- [ ] **Step 4: Implement spec parser**

`packages/core/src/parser.ts`:
```typescript
import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import matter from "gray-matter";
import { parse as parseYaml } from "yaml";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";
import { validateSpec, type ValidationResult } from "@sdx/schema";
import type { BaseSpec, SpecType } from "@sdx/schema";

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

export interface ParsedSpec {
  filePath: string;
  frontmatter: BaseSpec & Record<string, unknown>;
  content: string;
  sections: string[];
  valid: boolean;
  validationErrors: ValidationResult["errors"];
}

export async function parseSpec(filePath: string): Promise<ParsedSpec> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch {
    throw new ParseError(`Cannot read spec file: ${filePath}`);
  }

  const ext = extname(filePath).toLowerCase();

  if (ext === ".yaml" || ext === ".yml") {
    return parseYamlSpec(filePath, raw);
  }

  return parseMarkdownSpec(filePath, raw);
}

function parseMarkdownSpec(filePath: string, raw: string): ParsedSpec {
  const { data, content } = matter(raw);
  const sections = extractSections(content);
  const frontmatter = data as BaseSpec & Record<string, unknown>;

  const specType = frontmatter.type as SpecType | undefined;
  let valid = false;
  let validationErrors: ValidationResult["errors"] = null;

  if (specType) {
    const result = validateSpec(specType, data);
    valid = result.valid;
    validationErrors = result.errors;
  }

  return { filePath, frontmatter, content, sections, valid, validationErrors };
}

function parseYamlSpec(filePath: string, raw: string): ParsedSpec {
  let data: Record<string, unknown>;
  try {
    data = parseYaml(raw) as Record<string, unknown>;
  } catch (err) {
    throw new ParseError(`Invalid YAML in ${filePath}: ${(err as Error).message}`);
  }

  const frontmatter = data as BaseSpec & Record<string, unknown>;
  const specType = frontmatter.type as SpecType | undefined;
  let valid = false;
  let validationErrors: ValidationResult["errors"] = null;

  if (specType) {
    const result = validateSpec(specType, data);
    valid = result.valid;
    validationErrors = result.errors;
  }

  return {
    filePath,
    frontmatter,
    content: "",
    sections: [],
    valid,
    validationErrors,
  };
}

function extractSections(markdown: string): string[] {
  const tree = unified().use(remarkParse).parse(markdown);
  const sections: string[] = [];

  visit(tree, "heading", (node: any) => {
    if (node.depth === 2) {
      const text = node.children
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.value)
        .join("");
      if (text) sections.push(text);
    }
  });

  return sections;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm build --filter=@sdx/schema && cd packages/core && pnpm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/parser.ts packages/core/src/parser.test.ts packages/core/test/fixtures/specs/
git commit -m "feat(core): add spec parser for markdown and YAML formats"
```

---

## Task 7: @sdx/core — Dependency Graph

**Files:**
- Create: `packages/core/src/graph.ts`
- Test: `packages/core/src/graph.test.ts`

- [ ] **Step 1: Write test for dependency graph**

`packages/core/src/graph.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { buildGraph, GraphError } from "./graph.js";
import type { SdxConfig } from "@sdx/schema";

const makeConfig = (specs: SdxConfig["specs"]): SdxConfig => ({
  version: "1.0",
  specs,
});

describe("buildGraph", () => {
  it("builds a graph from spec dependencies", () => {
    const config = makeConfig({
      prd: { path: "specs/prd.md", type: "prd" },
      technical: { path: "specs/tech.md", type: "technical-design", requires: ["prd"] },
      stories: { path: "specs/stories/*.md", type: "user-story", requires: ["prd"] },
      testplan: { path: "specs/tp.md", type: "test-plan", requires: ["technical", "stories"] },
    });
    const graph = buildGraph(config);
    expect(graph.nodes).toHaveLength(4);
    expect(graph.edges).toContainEqual({ from: "prd", to: "technical" });
    expect(graph.edges).toContainEqual({ from: "prd", to: "stories" });
  });

  it("returns topologically sorted nodes", () => {
    const config = makeConfig({
      prd: { path: "specs/prd.md", type: "prd" },
      technical: { path: "specs/tech.md", type: "technical-design", requires: ["prd"] },
      testplan: { path: "specs/tp.md", type: "test-plan", requires: ["technical"] },
    });
    const graph = buildGraph(config);
    const sorted = graph.topologicalSort();
    expect(sorted.indexOf("prd")).toBeLessThan(sorted.indexOf("technical"));
    expect(sorted.indexOf("technical")).toBeLessThan(sorted.indexOf("testplan"));
  });

  it("detects circular dependencies", () => {
    const config = makeConfig({
      a: { path: "specs/a.md", type: "prd", requires: ["b"] },
      b: { path: "specs/b.md", type: "prd", requires: ["a"] },
    });
    expect(() => buildGraph(config)).toThrow(GraphError);
    expect(() => buildGraph(config)).toThrow(/circular/i);
  });

  it("returns downstream dependents of a node", () => {
    const config = makeConfig({
      prd: { path: "specs/prd.md", type: "prd" },
      technical: { path: "specs/tech.md", type: "technical-design", requires: ["prd"] },
      stories: { path: "specs/stories/*.md", type: "user-story", requires: ["prd"] },
    });
    const graph = buildGraph(config);
    const downstream = graph.getDownstream("prd");
    expect(downstream).toContain("technical");
    expect(downstream).toContain("stories");
  });

  it("validates that requires references exist", () => {
    const config = makeConfig({
      prd: { path: "specs/prd.md", type: "prd", requires: ["nonexistent"] },
    });
    expect(() => buildGraph(config)).toThrow(GraphError);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && pnpm test`
Expected: FAIL

- [ ] **Step 3: Implement dependency graph**

`packages/core/src/graph.ts`:
```typescript
import type { SdxConfig } from "@sdx/schema";

export class GraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GraphError";
  }
}

export interface Edge {
  from: string;
  to: string;
}

export interface DependencyGraph {
  nodes: string[];
  edges: Edge[];
  topologicalSort(): string[];
  getDownstream(nodeId: string): string[];
  getUpstream(nodeId: string): string[];
}

export function buildGraph(config: SdxConfig): DependencyGraph {
  const specNames = Object.keys(config.specs);
  const adjacency = new Map<string, string[]>();
  const reverseAdj = new Map<string, string[]>();
  const edges: Edge[] = [];

  for (const name of specNames) {
    adjacency.set(name, []);
    reverseAdj.set(name, []);
  }

  for (const [name, entry] of Object.entries(config.specs)) {
    if (!entry.requires) continue;
    for (const dep of entry.requires) {
      if (!adjacency.has(dep)) {
        throw new GraphError(
          `Spec "${name}" requires "${dep}", which does not exist in the config.`,
        );
      }
      adjacency.get(dep)!.push(name);
      reverseAdj.get(name)!.push(dep);
      edges.push({ from: dep, to: name });
    }
  }

  // Detect cycles via topological sort (Kahn's algorithm)
  const inDegree = new Map<string, number>();
  for (const name of specNames) {
    inDegree.set(name, reverseAdj.get(name)!.length);
  }

  const queue: string[] = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) queue.push(name);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const node = queue.shift()!;
    sorted.push(node);
    for (const neighbor of adjacency.get(node)!) {
      const newDegree = inDegree.get(neighbor)! - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) queue.push(neighbor);
    }
  }

  if (sorted.length !== specNames.length) {
    const remaining = specNames.filter((n) => !sorted.includes(n));
    throw new GraphError(
      `Circular dependency detected involving: ${remaining.join(", ")}`,
    );
  }

  return {
    nodes: specNames,
    edges,
    topologicalSort: () => [...sorted],
    getDownstream(nodeId: string): string[] {
      const visited = new Set<string>();
      const stack = [nodeId];
      while (stack.length > 0) {
        const current = stack.pop()!;
        for (const neighbor of adjacency.get(current) ?? []) {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            stack.push(neighbor);
          }
        }
      }
      return [...visited];
    },
    getUpstream(nodeId: string): string[] {
      const visited = new Set<string>();
      const stack = [nodeId];
      while (stack.length > 0) {
        const current = stack.pop()!;
        for (const dep of reverseAdj.get(current) ?? []) {
          if (!visited.has(dep)) {
            visited.add(dep);
            stack.push(dep);
          }
        }
      }
      return [...visited];
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/core && pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/graph.ts packages/core/src/graph.test.ts
git commit -m "feat(core): add dependency graph builder with cycle detection and topological sort"
```

---

## Task 8: @sdx/core — Utilities (Glob, Token Counter, Logger) & Exports

**Files:**
- Create: `packages/core/src/glob.ts`, `packages/core/src/tokens.ts`, `packages/core/src/logger.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/src/glob.test.ts`, `packages/core/src/tokens.test.ts`, `packages/core/src/logger.test.ts`

- [ ] **Step 1: Write tests for glob resolver**

`packages/core/src/glob.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { resolveGlob } from "./glob.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, "../test/fixtures");

describe("resolveGlob", () => {
  it("resolves a specific file path", async () => {
    const files = await resolveGlob("specs/prd.md", fixturesDir);
    expect(files).toHaveLength(1);
    expect(files[0]).toContain("prd.md");
  });

  it("resolves glob patterns", async () => {
    const files = await resolveGlob("specs/*.md", fixturesDir);
    expect(files.length).toBeGreaterThan(0);
  });

  it("returns empty array for no matches", async () => {
    const files = await resolveGlob("nonexistent/*.xyz", fixturesDir);
    expect(files).toEqual([]);
  });
});
```

- [ ] **Step 2: Implement glob resolver**

`packages/core/src/glob.ts`:
```typescript
import { glob } from "tinyglobby";
import { join, isAbsolute } from "node:path";

export async function resolveGlob(
  pattern: string,
  baseDir: string,
): Promise<string[]> {
  const absolutePattern = isAbsolute(pattern) ? pattern : join(baseDir, pattern);
  return glob([absolutePattern], { absolute: true });
}
```

- [ ] **Step 3: Write tests for token counter**

`packages/core/src/tokens.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { countTokens } from "./tokens.js";

describe("countTokens", () => {
  it("counts tokens for a simple string", () => {
    const count = countTokens("Hello, world!");
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(10);
  });

  it("returns 0 for empty string", () => {
    expect(countTokens("")).toBe(0);
  });

  it("counts within ±10% of expected for longer text", () => {
    // "The quick brown fox jumps over the lazy dog" ≈ 9-10 tokens
    const count = countTokens("The quick brown fox jumps over the lazy dog");
    expect(count).toBeGreaterThanOrEqual(8);
    expect(count).toBeLessThanOrEqual(12);
  });
});
```

- [ ] **Step 4: Implement token counter**

`packages/core/src/tokens.ts`:
```typescript
import { encodingForModel } from "js-tiktoken";

let encoder: ReturnType<typeof encodingForModel> | undefined;

function getEncoder() {
  if (!encoder) {
    encoder = encodingForModel("gpt-4o");
  }
  return encoder;
}

export function countTokens(text: string): number {
  if (!text) return 0;
  return getEncoder().encode(text).length;
}
```

- [ ] **Step 5: Write tests for logger**

`packages/core/src/logger.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { createLogger, type LogLevel } from "./logger.js";

describe("createLogger", () => {
  it("creates a logger with default level", () => {
    const logger = createLogger();
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("respects quiet mode", () => {
    const logger = createLogger({ quiet: true });
    // In quiet mode, logger level should suppress info
    expect(logger.level).toBeLessThan(3);
  });

  it("respects verbose mode", () => {
    const logger = createLogger({ verbose: true });
    expect(logger.level).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **Step 6: Implement logger**

`packages/core/src/logger.ts`:
```typescript
import { createConsola, type ConsolaInstance } from "consola";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LoggerOptions {
  quiet?: boolean;
  verbose?: boolean;
}

export interface Logger extends ConsolaInstance {
  level: number;
}

export function createLogger(options?: LoggerOptions): Logger {
  let level = 3; // info
  if (options?.quiet) level = 1; // only errors
  if (options?.verbose) level = 4; // debug

  return createConsola({ level }) as Logger;
}
```

- [ ] **Step 7: Update core index.ts with all public exports**

`packages/core/src/index.ts`:
```typescript
export { loadConfig, ConfigError } from "./config.js";
export { parseSpec, ParseError, type ParsedSpec } from "./parser.js";
export { buildGraph, GraphError, type DependencyGraph, type Edge } from "./graph.js";
export { resolveGlob } from "./glob.js";
export { countTokens } from "./tokens.js";
export { createLogger, type Logger, type LoggerOptions, type LogLevel } from "./logger.js";
```

- [ ] **Step 8: Run all core tests**

Run: `pnpm build --filter=@sdx/schema && cd packages/core && pnpm test`
Expected: PASS — all config, parser, graph, glob, tokens, logger tests pass

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/
git commit -m "feat(core): add glob resolver, token counter, logger, and public exports"
```

---

## Task 9: @sdx/lint — Engine & Types

**Files:**
- Create: `packages/lint/src/types.ts`
- Create: `packages/lint/src/engine.ts`
- Test: `packages/lint/src/engine.test.ts`

- [ ] **Step 1: Write test for lint engine**

`packages/lint/src/engine.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { createLintEngine } from "./engine.js";
import type { LintRule, LintContext, Diagnostic } from "./types.js";
import type { ParsedSpec } from "@sdx/core";

const mockSpec: ParsedSpec = {
  filePath: "specs/prd.md",
  frontmatter: {
    id: "prd-001",
    type: "prd",
    title: "Test",
    status: "draft",
    version: "1.0",
    created: "2026-01-01",
    authors: ["dev"],
  },
  content: "## Problem Statement\n\nSome content.",
  sections: ["Problem Statement"],
  valid: true,
  validationErrors: null,
};

const alwaysWarnRule: LintRule = {
  id: "test/always-warn",
  description: "Always produces a warning",
  severity: "warn",
  run(context: LintContext): Diagnostic[] {
    return [
      {
        ruleId: "test/always-warn",
        severity: "warn",
        message: "This is a test warning",
        filePath: context.spec.filePath,
      },
    ];
  },
};

const alwaysPassRule: LintRule = {
  id: "test/always-pass",
  description: "Never produces diagnostics",
  severity: "error",
  run(): Diagnostic[] {
    return [];
  },
};

describe("createLintEngine", () => {
  it("runs rules and collects diagnostics", () => {
    const engine = createLintEngine({ rules: [alwaysWarnRule] });
    const results = engine.lint([mockSpec]);
    expect(results.diagnostics).toHaveLength(1);
    expect(results.diagnostics[0]!.ruleId).toBe("test/always-warn");
    expect(results.diagnostics[0]!.severity).toBe("warn");
  });

  it("returns empty diagnostics when all rules pass", () => {
    const engine = createLintEngine({ rules: [alwaysPassRule] });
    const results = engine.lint([mockSpec]);
    expect(results.diagnostics).toHaveLength(0);
  });

  it("reports hasErrors correctly", () => {
    const errorRule: LintRule = {
      id: "test/error",
      description: "Error rule",
      severity: "error",
      run(ctx): Diagnostic[] {
        return [{ ruleId: "test/error", severity: "error", message: "fail", filePath: ctx.spec.filePath }];
      },
    };
    const engine = createLintEngine({ rules: [errorRule] });
    const results = engine.lint([mockSpec]);
    expect(results.hasErrors).toBe(true);
  });

  it("passes context with config and all specs to each rule", () => {
    let receivedContext: LintContext | undefined;
    const spyRule: LintRule = {
      id: "test/spy",
      description: "Captures context",
      severity: "warn",
      run(ctx): Diagnostic[] {
        receivedContext = ctx;
        return [];
      },
    };
    const engine = createLintEngine({ rules: [spyRule] });
    engine.lint([mockSpec]);
    expect(receivedContext).toBeDefined();
    expect(receivedContext!.spec).toEqual(mockSpec);
    expect(receivedContext!.allSpecs).toEqual([mockSpec]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm build --filter=@sdx/schema --filter=@sdx/core && cd packages/lint && pnpm test`
Expected: FAIL

- [ ] **Step 3: Create types.ts**

`packages/lint/src/types.ts`:
```typescript
import type { ParsedSpec, DependencyGraph } from "@sdx/core";
import type { SdxConfig } from "@sdx/schema";

export type Severity = "error" | "warn" | "info";

export interface Diagnostic {
  ruleId: string;
  severity: Severity;
  message: string;
  filePath: string;
  line?: number;
  section?: string;
}

export interface LintContext {
  spec: ParsedSpec;
  allSpecs: ParsedSpec[];
  config?: SdxConfig;
  graph?: DependencyGraph;
}

export interface LintRule {
  id: string;
  description: string;
  severity: Severity;
  run(context: LintContext): Diagnostic[];
}

export interface LintResults {
  diagnostics: Diagnostic[];
  hasErrors: boolean;
  hasWarnings: boolean;
}
```

- [ ] **Step 4: Create engine.ts**

`packages/lint/src/engine.ts`:
```typescript
import type { ParsedSpec, DependencyGraph } from "@sdx/core";
import type { SdxConfig } from "@sdx/schema";
import type { LintRule, LintResults, Diagnostic } from "./types.js";

export interface LintEngineOptions {
  rules: LintRule[];
  config?: SdxConfig;
  graph?: DependencyGraph;
}

export interface LintEngine {
  lint(specs: ParsedSpec[]): LintResults;
}

export function createLintEngine(options: LintEngineOptions): LintEngine {
  return {
    lint(specs: ParsedSpec[]): LintResults {
      const diagnostics: Diagnostic[] = [];

      for (const spec of specs) {
        for (const rule of options.rules) {
          const results = rule.run({
            spec,
            allSpecs: specs,
            config: options.config,
            graph: options.graph,
          });
          diagnostics.push(...results);
        }
      }

      return {
        diagnostics,
        hasErrors: diagnostics.some((d) => d.severity === "error"),
        hasWarnings: diagnostics.some((d) => d.severity === "warn"),
      };
    },
  };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm build --filter=@sdx/schema --filter=@sdx/core && cd packages/lint && pnpm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/lint/src/types.ts packages/lint/src/engine.ts packages/lint/src/engine.test.ts
git commit -m "feat(lint): add lint engine with rule runner and diagnostic collection"
```

---

## Task 10: @sdx/lint — Structure Rules

**Files:**
- Create: `packages/lint/src/rules/valid-frontmatter.ts`
- Create: `packages/lint/src/rules/required-sections.ts`
- Create: `packages/lint/src/rules/valid-references.ts`
- Create: `packages/lint/src/rules/no-circular-deps.ts`
- Create: `packages/lint/src/rules/index.ts`
- Test: `packages/lint/src/rules/structure-rules.test.ts`

- [ ] **Step 1: Write tests for structure rules**

`packages/lint/src/rules/structure-rules.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { validFrontmatterRule } from "./valid-frontmatter.js";
import { requiredSectionsRule } from "./required-sections.js";
import { validReferencesRule } from "./valid-references.js";
import { noCircularDepsRule } from "./no-circular-deps.js";
import type { LintContext } from "../types.js";
import type { ParsedSpec } from "@sdx/core";

function makeSpec(overrides: Partial<ParsedSpec> = {}): ParsedSpec {
  return {
    filePath: "specs/prd.md",
    frontmatter: {
      id: "prd-001", type: "prd", title: "Test", status: "draft",
      version: "1.0", created: "2026-01-01", authors: ["dev"],
    },
    content: "",
    sections: ["Problem Statement", "Goals", "Non-Goals", "Features", "Success Criteria"],
    valid: true,
    validationErrors: null,
    ...overrides,
  };
}

function makeContext(spec: ParsedSpec, allSpecs?: ParsedSpec[]): LintContext {
  return { spec, allSpecs: allSpecs ?? [spec] };
}

describe("valid-frontmatter", () => {
  it("passes for valid frontmatter", () => {
    const spec = makeSpec();
    const diags = validFrontmatterRule.run(makeContext(spec));
    expect(diags).toHaveLength(0);
  });

  it("reports errors for invalid frontmatter", () => {
    const spec = makeSpec({ valid: false, validationErrors: [{ message: "missing id" } as any] });
    const diags = validFrontmatterRule.run(makeContext(spec));
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.severity).toBe("error");
  });
});

describe("required-sections", () => {
  it("passes when all required sections are present", () => {
    const spec = makeSpec();
    const diags = requiredSectionsRule.run(makeContext(spec));
    expect(diags).toHaveLength(0);
  });

  it("reports missing sections", () => {
    const spec = makeSpec({ sections: ["Problem Statement"] });
    const diags = requiredSectionsRule.run(makeContext(spec));
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.message).toContain("Goals");
  });

  it("skips YAML specs (no markdown sections to check)", () => {
    const spec = makeSpec({ filePath: "specs/story.yaml", sections: [], content: "" });
    const diags = requiredSectionsRule.run(makeContext(spec));
    expect(diags).toHaveLength(0);
  });
});

describe("valid-references", () => {
  it("passes when all references exist", () => {
    const prd = makeSpec({
      frontmatter: {
        id: "prd-001", type: "prd", title: "PRD", status: "draft",
        version: "1.0", created: "2026-01-01", authors: ["dev"],
        references: [{ id: "tech-001", relationship: "implemented-by" as const }],
      },
    });
    const tech = makeSpec({
      filePath: "specs/tech.md",
      frontmatter: {
        id: "tech-001", type: "technical-design", title: "Tech", status: "draft",
        version: "1.0", created: "2026-01-01", authors: ["dev"],
      },
    });
    const diags = validReferencesRule.run(makeContext(prd, [prd, tech]));
    expect(diags).toHaveLength(0);
  });

  it("reports broken references", () => {
    const prd = makeSpec({
      frontmatter: {
        id: "prd-001", type: "prd", title: "PRD", status: "draft",
        version: "1.0", created: "2026-01-01", authors: ["dev"],
        references: [{ id: "nonexistent", relationship: "implemented-by" as const }],
      },
    });
    const diags = validReferencesRule.run(makeContext(prd, [prd]));
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.message).toContain("nonexistent");
  });
});

describe("no-circular-deps", () => {
  it("passes with no graph (no-op without config context)", () => {
    const spec = makeSpec();
    const diags = noCircularDepsRule.run(makeContext(spec));
    expect(diags).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/lint && pnpm test`
Expected: FAIL

- [ ] **Step 3: Implement structure rules**

`packages/lint/src/rules/valid-frontmatter.ts`:
```typescript
import type { LintRule } from "../types.js";

export const validFrontmatterRule: LintRule = {
  id: "structure/valid-frontmatter",
  description: "Frontmatter matches the schema for the declared spec type",
  severity: "error",
  run(context) {
    if (context.spec.valid) return [];

    const errors = context.spec.validationErrors ?? [];
    return errors.map((err) => ({
      ruleId: "structure/valid-frontmatter",
      severity: "error" as const,
      message: `Invalid frontmatter: ${err.message ?? JSON.stringify(err)}`,
      filePath: context.spec.filePath,
    }));
  },
};
```

`packages/lint/src/rules/required-sections.ts`:
```typescript
import type { LintRule } from "../types.js";
import { REQUIRED_SECTIONS, type SpecType } from "@sdx/schema";

export const requiredSectionsRule: LintRule = {
  id: "structure/required-sections",
  description: "Spec body contains all required sections for its type",
  severity: "error",
  run(context) {
    // Skip YAML specs (no markdown body to check sections in)
    const ext = context.spec.filePath.split(".").pop()?.toLowerCase();
    if (ext === "yaml" || ext === "yml") return [];

    const specType = context.spec.frontmatter.type as SpecType;
    const required = REQUIRED_SECTIONS[specType];
    if (!required) return [];

    const missing = required.filter((s) => !context.spec.sections.includes(s));
    return missing.map((section) => ({
      ruleId: "structure/required-sections",
      severity: "error" as const,
      message: `Missing required section: "${section}"`,
      filePath: context.spec.filePath,
      section,
    }));
  },
};
```

`packages/lint/src/rules/valid-references.ts`:
```typescript
import type { LintRule } from "../types.js";

export const validReferencesRule: LintRule = {
  id: "structure/valid-references",
  description: "All references in frontmatter point to specs that exist in the suite",
  severity: "error",
  run(context) {
    const refs = context.spec.frontmatter.references;
    if (!refs || refs.length === 0) return [];

    const allIds = new Set(context.allSpecs.map((s) => s.frontmatter.id));

    return refs
      .filter((ref) => !allIds.has(ref.id))
      .map((ref) => ({
        ruleId: "structure/valid-references",
        severity: "error" as const,
        message: `Reference "${ref.id}" does not match any spec in the suite`,
        filePath: context.spec.filePath,
      }));
  },
};
```

`packages/lint/src/rules/no-circular-deps.ts`:
```typescript
import type { LintRule } from "../types.js";

export const noCircularDepsRule: LintRule = {
  id: "structure/no-circular-deps",
  description: "The dependency graph has no cycles",
  severity: "error",
  run(context) {
    // Cycle detection happens in buildGraph() — if we have a graph, it's already acyclic.
    // This rule is a no-op at the individual spec level; the engine should catch
    // GraphError during setup. Included for completeness in rule listing.
    return [];
  },
};
```

`packages/lint/src/rules/index.ts`:
```typescript
import { validFrontmatterRule } from "./valid-frontmatter.js";
import { requiredSectionsRule } from "./required-sections.js";
import { validReferencesRule } from "./valid-references.js";
import { noCircularDepsRule } from "./no-circular-deps.js";
import type { LintRule } from "../types.js";

export const structureRules: LintRule[] = [
  validFrontmatterRule,
  requiredSectionsRule,
  validReferencesRule,
  noCircularDepsRule,
];

export {
  validFrontmatterRule,
  requiredSectionsRule,
  validReferencesRule,
  noCircularDepsRule,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm build --filter=@sdx/schema --filter=@sdx/core && cd packages/lint && pnpm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/lint/src/rules/
git commit -m "feat(lint): add structure rules (valid-frontmatter, required-sections, valid-references, no-circular-deps)"
```

---

## Task 11: @sdx/lint — Content Rules, Presets & Exports

**Files:**
- Create: `packages/lint/src/rules/story-coverage.ts`
- Create: `packages/lint/src/rules/staleness-check.ts`
- Create: `packages/lint/src/rules/no-vague-language.ts`
- Create: `packages/lint/src/presets.ts`
- Create: `packages/lint/src/custom-rule-loader.ts`
- Modify: `packages/lint/src/rules/index.ts`
- Modify: `packages/lint/src/index.ts`
- Test: `packages/lint/src/rules/content-rules.test.ts`
- Test: `packages/lint/src/presets.test.ts`

- [ ] **Step 1: Write tests for content rules**

`packages/lint/src/rules/content-rules.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { storyCoverageRule } from "./story-coverage.js";
import { stalenessCheckRule } from "./staleness-check.js";
import { noVagueLanguageRule } from "./no-vague-language.js";
import type { LintContext } from "../types.js";
import type { ParsedSpec } from "@sdx/core";

function makeSpec(overrides: Partial<ParsedSpec> = {}): ParsedSpec {
  return {
    filePath: "specs/prd.md",
    frontmatter: {
      id: "prd-001", type: "prd", title: "Test", status: "draft",
      version: "1.0", created: "2026-01-01", authors: ["dev"],
    },
    content: "## Features\n\n- **F1**: Login\n- **F2**: OAuth\n",
    sections: ["Features"],
    valid: true,
    validationErrors: null,
    ...overrides,
  };
}

describe("story-coverage", () => {
  it("warns when PRD features lack corresponding stories", () => {
    const prd = makeSpec();
    const diags = storyCoverageRule.run({
      spec: prd,
      allSpecs: [prd],
    });
    // No stories exist, so features F1 and F2 lack coverage
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.severity).toBe("warn");
  });

  it("passes when features have corresponding stories", () => {
    const prd = makeSpec();
    const story1: ParsedSpec = {
      filePath: "specs/stories/login.md",
      frontmatter: {
        id: "story-001", type: "user-story", title: "Login flow",
        status: "draft", version: "1.0", created: "2026-01-01", authors: ["dev"],
        story_id: "US-001", priority: "high", estimate: "3",
        references: [{ id: "prd-001", relationship: "depends-on" }],
      },
      content: "## Description\n\nImplement F1: Login",
      sections: ["Description"],
      valid: true,
      validationErrors: null,
    };
    const story2: ParsedSpec = {
      filePath: "specs/stories/oauth.md",
      frontmatter: {
        id: "story-002", type: "user-story", title: "OAuth flow",
        status: "draft", version: "1.0", created: "2026-01-01", authors: ["dev"],
        story_id: "US-002", priority: "high", estimate: "5",
        references: [{ id: "prd-001", relationship: "depends-on" }],
      },
      content: "## Description\n\nImplement F2: OAuth",
      sections: ["Description"],
      valid: true,
      validationErrors: null,
    };
    const diags = storyCoverageRule.run({
      spec: prd,
      allSpecs: [prd, story1, story2],
    });
    expect(diags).toHaveLength(0);
  });

  it("skips non-PRD specs", () => {
    const tech = makeSpec({
      frontmatter: {
        id: "tech-001", type: "technical-design", title: "Tech",
        status: "draft", version: "1.0", created: "2026-01-01", authors: ["dev"],
      },
    });
    const diags = storyCoverageRule.run({ spec: tech, allSpecs: [tech] });
    expect(diags).toHaveLength(0);
  });
});

describe("no-vague-language", () => {
  it("flags known vague phrases", () => {
    const spec = makeSpec({
      content: "## Problem Statement\n\nWe should handle edge cases as appropriate. TBD.",
    });
    const diags = noVagueLanguageRule.run({ spec, allSpecs: [spec] });
    expect(diags.length).toBeGreaterThan(0);
    expect(diags.some((d) => d.message.includes("as appropriate"))).toBe(true);
  });

  it("passes clean content", () => {
    const spec = makeSpec({
      content: "## Problem Statement\n\nUsers need secure authentication with email and password.",
    });
    const diags = noVagueLanguageRule.run({ spec, allSpecs: [spec] });
    expect(diags).toHaveLength(0);
  });
});

describe("staleness-check", () => {
  it("warns when downstream is older than upstream", () => {
    const prd = makeSpec({
      frontmatter: {
        id: "prd-001", type: "prd", title: "PRD", status: "draft",
        version: "1.0", created: "2026-01-01", updated: "2026-03-15", authors: ["dev"],
      },
    });
    const tech: ParsedSpec = {
      filePath: "specs/tech.md",
      frontmatter: {
        id: "tech-001", type: "technical-design", title: "Tech", status: "draft",
        version: "1.0", created: "2026-01-01", updated: "2026-02-01", authors: ["dev"],
        references: [{ id: "prd-001", relationship: "depends-on" }],
      },
      content: "",
      sections: [],
      valid: true,
      validationErrors: null,
    };
    const diags = stalenessCheckRule.run({
      spec: tech,
      allSpecs: [prd, tech],
    });
    expect(diags.length).toBeGreaterThan(0);
    expect(diags[0]!.severity).toBe("warn");
    expect(diags[0]!.message).toContain("stale");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/lint && pnpm test`
Expected: FAIL

- [ ] **Step 3: Implement content rules**

`packages/lint/src/rules/story-coverage.ts`:
```typescript
import type { LintRule } from "../types.js";

const FEATURE_PATTERN = /\*\*F\d+\*\*:\s*(.+)/g;

export const storyCoverageRule: LintRule = {
  id: "completeness/story-coverage",
  description: "Every feature listed in a PRD has at least one corresponding user story",
  severity: "warn",
  run(context) {
    if (context.spec.frontmatter.type !== "prd") return [];

    const features: string[] = [];
    let match;
    const re = new RegExp(FEATURE_PATTERN.source, "g");
    while ((match = re.exec(context.spec.content)) !== null) {
      features.push(match[1]!.trim());
    }
    if (features.length === 0) return [];

    const stories = context.allSpecs.filter(
      (s) => s.frontmatter.type === "user-story",
    );
    const storyContent = stories.map((s) => s.content + " " + s.frontmatter.title).join(" ");

    return features
      .filter((feature) => {
        const featureName = feature.toLowerCase();
        return !storyContent.toLowerCase().includes(featureName);
      })
      .map((feature) => ({
        ruleId: "completeness/story-coverage",
        severity: "warn" as const,
        message: `Feature "${feature}" has no corresponding user story`,
        filePath: context.spec.filePath,
      }));
  },
};
```

`packages/lint/src/rules/staleness-check.ts`:
```typescript
import type { LintRule } from "../types.js";

export const stalenessCheckRule: LintRule = {
  id: "freshness/staleness-check",
  description: "Warns if a spec hasn't been updated since its upstream dependency changed",
  severity: "warn",
  run(context) {
    const refs = context.spec.frontmatter.references;
    if (!refs || refs.length === 0) return [];

    const specUpdated = context.spec.frontmatter.updated ?? context.spec.frontmatter.created;
    const specDate = new Date(specUpdated);

    const diagnostics = [];

    for (const ref of refs) {
      if (ref.relationship !== "depends-on" && ref.relationship !== "implemented-by") {
        continue;
      }
      const upstream = context.allSpecs.find((s) => s.frontmatter.id === ref.id);
      if (!upstream) continue;

      const upstreamUpdated = upstream.frontmatter.updated ?? upstream.frontmatter.created;
      const upstreamDate = new Date(upstreamUpdated);

      if (upstreamDate > specDate) {
        diagnostics.push({
          ruleId: "freshness/staleness-check",
          severity: "warn" as const,
          message: `Potentially stale: upstream "${upstream.frontmatter.id}" was updated on ${upstreamUpdated}, but this spec was last updated on ${specUpdated}`,
          filePath: context.spec.filePath,
        });
      }
    }

    return diagnostics;
  },
};
```

`packages/lint/src/rules/no-vague-language.ts`:
```typescript
import type { LintRule } from "../types.js";

const DEFAULT_VAGUE_PATTERNS = [
  "as appropriate",
  "handle edge cases",
  "as needed",
  "etc\\.",
  "TBD",
  "TODO",
  "and so on",
  "various",
  "somehow",
  "straightforward",
  "obviously",
  "simply",
  "just need to",
];

export const noVagueLanguageRule: LintRule = {
  id: "clarity/no-vague-language",
  description: "Flags known ambiguous phrases",
  severity: "warn",
  run(context) {
    if (!context.spec.content) return [];

    const diagnostics = [];

    for (const pattern of DEFAULT_VAGUE_PATTERNS) {
      const regex = new RegExp(`\\b${pattern}\\b`, "gi");
      let match;
      while ((match = regex.exec(context.spec.content)) !== null) {
        diagnostics.push({
          ruleId: "clarity/no-vague-language",
          severity: "warn" as const,
          message: `Vague language: "${match[0]}"`,
          filePath: context.spec.filePath,
        });
      }
    }

    return diagnostics;
  },
};
```

- [ ] **Step 4: Write test for presets**

`packages/lint/src/presets.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { getPreset } from "./presets.js";

describe("presets", () => {
  it("minimal preset includes only structure rules", () => {
    const rules = getPreset("minimal");
    expect(rules.every((r) => r.id.startsWith("structure/"))).toBe(true);
  });

  it("recommended preset includes structure + content rules", () => {
    const rules = getPreset("recommended");
    expect(rules.some((r) => r.id.startsWith("structure/"))).toBe(true);
    expect(rules.some((r) => r.id.startsWith("completeness/"))).toBe(true);
    expect(rules.some((r) => r.id.startsWith("clarity/"))).toBe(true);
  });

  it("strict preset includes all rules with error severity", () => {
    const rules = getPreset("strict");
    expect(rules.length).toBeGreaterThanOrEqual(7);
  });
});
```

- [ ] **Step 5: Implement presets**

`packages/lint/src/presets.ts`:
```typescript
import type { LintRule } from "./types.js";
import { structureRules } from "./rules/index.js";
import { storyCoverageRule } from "./rules/story-coverage.js";
import { stalenessCheckRule } from "./rules/staleness-check.js";
import { noVagueLanguageRule } from "./rules/no-vague-language.js";

const contentRules: LintRule[] = [
  storyCoverageRule,
  stalenessCheckRule,
  noVagueLanguageRule,
];

const allRules: LintRule[] = [...structureRules, ...contentRules];

export function getPreset(name: "minimal" | "recommended" | "strict"): LintRule[] {
  switch (name) {
    case "minimal":
      return structureRules;
    case "recommended":
      return allRules;
    case "strict":
      return allRules.map((rule) => ({ ...rule, severity: "error" }));
  }
}
```

Update `packages/lint/src/rules/index.ts` — add content rules to exports:
```typescript
export { storyCoverageRule } from "./story-coverage.js";
export { stalenessCheckRule } from "./staleness-check.js";
export { noVagueLanguageRule } from "./no-vague-language.js";

export const contentRules: LintRule[] = [
  storyCoverageRule,
  stalenessCheckRule,
  noVagueLanguageRule,
];

export const allBuiltinRules: LintRule[] = [...structureRules, ...contentRules];
```

- [ ] **Step 6: Create custom rule loader**

`packages/lint/src/custom-rule-loader.ts`:
```typescript
import { pathToFileURL } from "node:url";
import type { LintRule } from "./types.js";

export async function loadCustomRule(filePath: string): Promise<LintRule> {
  const module = await import(pathToFileURL(filePath).href);
  const rule = module.default ?? module.rule;
  if (!rule || !rule.id || !rule.run) {
    throw new Error(
      `Custom rule at ${filePath} must export a default LintRule with id and run function`,
    );
  }
  return rule as LintRule;
}
```

- [ ] **Step 7: Update lint index.ts with public exports**

`packages/lint/src/index.ts`:
```typescript
export { createLintEngine, type LintEngine, type LintEngineOptions } from "./engine.js";
export type { LintRule, LintContext, LintResults, Diagnostic, Severity } from "./types.js";
export { getPreset } from "./presets.js";
export { loadCustomRule } from "./custom-rule-loader.js";
export {
  structureRules,
  contentRules,
  allBuiltinRules,
  validFrontmatterRule,
  requiredSectionsRule,
  validReferencesRule,
  noCircularDepsRule,
  storyCoverageRule,
  stalenessCheckRule,
  noVagueLanguageRule,
} from "./rules/index.js";
```

- [ ] **Step 8: Run all lint tests**

Run: `pnpm build --filter=@sdx/schema --filter=@sdx/core && cd packages/lint && pnpm test`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add packages/lint/src/
git commit -m "feat(lint): add content rules (story-coverage, staleness, vague-language), presets, and custom rule loader"
```

---

## Task 12: @sdx/cli — Init Command

**Files:**
- Create: `packages/cli/src/main.ts`
- Create: `packages/cli/src/shared-args.ts`
- Create: `packages/cli/src/commands/init.ts`
- Test: `packages/cli/src/commands/init.test.ts`

- [ ] **Step 1: Write test for init command**

`packages/cli/src/commands/init.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { scaffoldProject } from "./init.js";

describe("scaffoldProject", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "sdx-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it("scaffolds a lightweight project", async () => {
    await scaffoldProject({
      projectName: "test-project",
      template: "lightweight",
      targetDir: tempDir,
    });

    const config = await readFile(join(tempDir, "spec.config.yaml"), "utf-8");
    expect(config).toContain("version:");
    expect(config).toContain("test-project");

    const files = await readdir(join(tempDir, "specs"));
    expect(files).toContain("prd.md");
    expect(files).toContain("technical-design.md");
  });

  it("scaffolds a bmad project", async () => {
    await scaffoldProject({
      projectName: "bmad-project",
      template: "bmad",
      targetDir: tempDir,
    });

    const config = await readFile(join(tempDir, "spec.config.yaml"), "utf-8");
    expect(config).toContain("bmad-project");
  });

  it("scaffolds an api-first project", async () => {
    await scaffoldProject({
      projectName: "api-project",
      template: "api-first",
      targetDir: tempDir,
    });

    const files = await readdir(join(tempDir, "specs"));
    expect(files).toContain("api-contract.md");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/cli && pnpm test`
Expected: FAIL

- [ ] **Step 3: Create shared args and init scaffolding logic**

`packages/cli/src/shared-args.ts`:
```typescript
export const sharedArgs = {
  quiet: {
    type: "boolean" as const,
    description: "Suppress info output",
    alias: ["q"],
  },
  verbose: {
    type: "boolean" as const,
    description: "Enable debug output",
    alias: ["V"],
  },
  format: {
    type: "string" as const,
    description: "Output format (pretty, json, github)",
    default: "pretty",
  },
};
```

`packages/cli/src/commands/init.ts`:
```typescript
import { defineCommand } from "citty";
import { mkdir, writeFile, cp } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface ScaffoldOptions {
  projectName: string;
  template: "lightweight" | "bmad" | "api-first";
  targetDir: string;
}

export async function scaffoldProject(options: ScaffoldOptions): Promise<void> {
  const { projectName, template, targetDir } = options;
  const specsDir = join(targetDir, "specs");
  await mkdir(specsDir, { recursive: true });

  const configs: Record<string, { specs: Record<string, any>; files: Record<string, string> }> = {
    lightweight: {
      specs: {
        prd: { path: "specs/prd.md", type: "prd", required: true },
        technical: { path: "specs/technical-design.md", type: "technical-design", requires: ["prd"] },
      },
      files: {
        "specs/prd.md": prdTemplate(projectName),
        "specs/technical-design.md": technicalDesignTemplate(projectName),
      },
    },
    bmad: {
      specs: {
        prd: { path: "specs/prd.md", type: "prd", required: true },
        technical: { path: "specs/technical-design.md", type: "technical-design", requires: ["prd"] },
        stories: { path: "specs/stories/*.md", type: "user-story", requires: ["prd"] },
        "test-plan": { path: "specs/test-plan.md", type: "test-plan", requires: ["technical", "stories"] },
        adr: { path: "specs/adr/*.md", type: "adr", requires: ["technical"] },
      },
      files: {
        "specs/prd.md": prdTemplate(projectName),
        "specs/technical-design.md": technicalDesignTemplate(projectName),
        "specs/test-plan.md": testPlanTemplate(projectName),
      },
    },
    "api-first": {
      specs: {
        technical: { path: "specs/technical-design.md", type: "technical-design" },
        "api-contract": { path: "specs/api-contract.md", type: "api-contract", requires: ["technical"] },
        "test-plan": { path: "specs/test-plan.md", type: "test-plan", requires: ["technical", "api-contract"] },
      },
      files: {
        "specs/technical-design.md": technicalDesignTemplate(projectName),
        "specs/api-contract.md": apiContractTemplate(projectName),
        "specs/test-plan.md": testPlanTemplate(projectName),
      },
    },
  };

  const templateConfig = configs[template]!;

  // Write spec.config.yaml
  const configYaml = buildConfigYaml(projectName, templateConfig.specs);
  await writeFile(join(targetDir, "spec.config.yaml"), configYaml);

  // Write spec files
  for (const [path, content] of Object.entries(templateConfig.files)) {
    const fullPath = join(targetDir, path);
    const dir = join(fullPath, "..");
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, content);
  }
}

function buildConfigYaml(name: string, specs: Record<string, any>): string {
  let yaml = `version: "1.0"\n\nproject:\n  name: "${name}"\n\nspecs:\n`;
  for (const [key, entry] of Object.entries(specs)) {
    yaml += `  ${key}:\n    path: "${entry.path}"\n    type: "${entry.type}"\n`;
    if (entry.required) yaml += `    required: true\n`;
    if (entry.requires) yaml += `    requires: [${entry.requires.map((r: string) => `"${r}"`).join(", ")}]\n`;
  }
  yaml += `\nlint:\n  extends: "recommended"\n`;
  return yaml;
}

function prdTemplate(name: string): string {
  const today = new Date().toISOString().split("T")[0];
  return `---
id: "prd-001"
type: "prd"
title: "${name}"
status: "draft"
version: "0.1"
created: "${today}"
authors: []
tags: []
---

# ${name}

## Problem Statement

<!-- What problem does this project solve? -->

## Goals

<!-- What are the primary goals? -->

## Non-Goals

<!-- What is explicitly out of scope? -->

## Features

- **F1**: <!-- Feature description -->

## Success Criteria

<!-- How do you know this is successful? -->
`;
}

function technicalDesignTemplate(name: string): string {
  const today = new Date().toISOString().split("T")[0];
  return `---
id: "tech-001"
type: "technical-design"
title: "${name} — Technical Design"
status: "draft"
version: "0.1"
created: "${today}"
authors: []
references:
  - id: "prd-001"
    relationship: "implemented-by"
---

# ${name} — Technical Design

## Overview

## Architecture

## Data Model

## API Design

## Dependencies

## Risks

## Open Questions
`;
}

function testPlanTemplate(name: string): string {
  const today = new Date().toISOString().split("T")[0];
  return `---
id: "tp-001"
type: "test-plan"
title: "${name} — Test Plan"
status: "draft"
version: "0.1"
created: "${today}"
authors: []
---

# ${name} — Test Plan

## Scope

## Test Cases

## Coverage Matrix

## Edge Cases
`;
}

function apiContractTemplate(name: string): string {
  const today = new Date().toISOString().split("T")[0];
  return `---
id: "api-001"
type: "api-contract"
title: "${name} — API Contract"
status: "draft"
version: "0.1"
created: "${today}"
authors: []
---

# ${name} — API Contract

## Endpoints

## Request/Response Schemas

## Auth

## Error Codes
`;
}

export default defineCommand({
  meta: {
    name: "init",
    description: "Initialize a new sdx spec suite",
  },
  args: {
    name: {
      type: "string",
      description: "Project name",
    },
    template: {
      type: "string",
      description: "Template to use (lightweight, bmad, api-first)",
      default: "lightweight",
    },
    dir: {
      type: "string",
      description: "Target directory",
      default: ".",
    },
  },
  async run({ args }) {
    const projectName = args.name ?? "my-project";
    const template = args.template as ScaffoldOptions["template"];
    const targetDir = resolve(args.dir);

    await scaffoldProject({ projectName, template, targetDir });
    console.log(`\n  Initialized sdx spec suite in ${targetDir}`);
    console.log(`  Template: ${template}`);
    console.log(`  Run 'sdx lint' to validate your specs.\n`);
  },
});
```

- [ ] **Step 4: Create main.ts (root CLI entry)**

`packages/cli/src/main.ts`:
```typescript
#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import initCommand from "./commands/init.js";

const main = defineCommand({
  meta: {
    name: "sdx",
    version: "0.0.0",
    description: "SDX — Spec Developer Experience. Validate, pack, diff, and ship specs.",
  },
  subCommands: {
    init: initCommand,
    lint: () => import("./commands/lint.js").then((m) => m.default),
    validate: () => import("./commands/validate.js").then((m) => m.default),
    graph: () => import("./commands/graph.js").then((m) => m.default),
  },
});

runMain(main);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm build --filter=@sdx/schema --filter=@sdx/core --filter=@sdx/lint && cd packages/cli && pnpm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/
git commit -m "feat(cli): add sdx init command with lightweight, bmad, and api-first templates"
```

---

## Task 13: @sdx/cli — Lint, Validate & Graph Commands

**Files:**
- Create: `packages/cli/src/commands/lint.ts`
- Create: `packages/cli/src/commands/validate.ts`
- Create: `packages/cli/src/commands/graph.ts`
- Create: `packages/cli/src/formatters/pretty.ts`
- Create: `packages/cli/src/formatters/json.ts`
- Create: `packages/cli/src/formatters/github.ts`
- Test: `packages/cli/src/commands/lint.test.ts`

- [ ] **Step 1: Write test for lint command logic**

`packages/cli/src/commands/lint.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runLint } from "./lint.js";

describe("runLint", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "sdx-lint-test-"));
    await mkdir(join(tempDir, "specs"), { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true });
  });

  it("returns diagnostics for a spec with issues", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      `version: "1.0"\nspecs:\n  prd:\n    path: "specs/prd.md"\n    type: "prd"\n`,
    );
    await writeFile(
      join(tempDir, "specs/prd.md"),
      `---\nid: "prd-001"\ntype: "prd"\ntitle: "Test"\nstatus: "draft"\nversion: "1.0"\ncreated: "2026-01-01"\nauthors: ["dev"]\n---\n\n# Test\n\n## Problem Statement\n\nSome content with TBD items.\n`,
    );

    const result = await runLint({ configDir: tempDir });
    // Should have warnings for missing sections and vague language
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });

  it("passes for a well-formed spec", async () => {
    await writeFile(
      join(tempDir, "spec.config.yaml"),
      `version: "1.0"\nspecs:\n  prd:\n    path: "specs/prd.md"\n    type: "prd"\n`,
    );
    await writeFile(
      join(tempDir, "specs/prd.md"),
      [
        "---",
        'id: "prd-001"',
        'type: "prd"',
        'title: "Test"',
        'status: "draft"',
        'version: "1.0"',
        'created: "2026-01-01"',
        'authors: ["dev"]',
        "---",
        "",
        "# Test",
        "",
        "## Problem Statement",
        "",
        "Users need a solution.",
        "",
        "## Goals",
        "",
        "- Be useful",
        "",
        "## Non-Goals",
        "",
        "- Everything else",
        "",
        "## Features",
        "",
        "- **F1**: Core feature",
        "",
        "## Success Criteria",
        "",
        "- It works",
      ].join("\n"),
    );

    const result = await runLint({ configDir: tempDir });
    const errors = result.diagnostics.filter((d) => d.severity === "error");
    expect(errors).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Implement lint command**

`packages/cli/src/commands/lint.ts`:
```typescript
import { defineCommand } from "citty";
import { resolve } from "node:path";
import { loadConfig, parseSpec, resolveGlob, buildGraph } from "@sdx/core";
import { createLintEngine, getPreset, type LintResults } from "@sdx/lint";
import type { ParsedSpec } from "@sdx/core";
import { sharedArgs } from "../shared-args.js";
import { formatPretty } from "../formatters/pretty.js";
import { formatJson } from "../formatters/json.js";
import { formatGithub } from "../formatters/github.js";
import { createLogger } from "@sdx/core";

export interface RunLintOptions {
  configDir: string;
  specPath?: string;
  preset?: "minimal" | "recommended" | "strict";
}

export async function runLint(options: RunLintOptions): Promise<LintResults> {
  const config = await loadConfig(undefined, options.configDir);
  const preset = options.preset ?? (config.lint?.extends as any) ?? "recommended";
  const rules = getPreset(preset);

  const specs: ParsedSpec[] = [];
  for (const [, entry] of Object.entries(config.specs)) {
    const files = await resolveGlob(entry.path, options.configDir);
    for (const file of files) {
      if (options.specPath && !file.includes(options.specPath)) continue;
      specs.push(await parseSpec(file));
    }
  }

  let graph;
  let graphError: string | undefined;
  try {
    graph = buildGraph(config);
  } catch (err) {
    graphError = (err as Error).message;
  }

  const engine = createLintEngine({ rules, config, graph });
  const results = engine.lint(specs);

  // Surface graph errors as diagnostics
  if (graphError) {
    results.diagnostics.push({
      ruleId: "structure/no-circular-deps",
      severity: "error",
      message: graphError,
      filePath: "spec.config.yaml",
    });
    results.hasErrors = true;
  }

  return results;
}

export default defineCommand({
  meta: {
    name: "lint",
    description: "Lint all specs in the suite",
  },
  args: {
    ...sharedArgs,
    fix: {
      type: "boolean",
      description: "Auto-fix issues where possible",
    },
    path: {
      type: "positional",
      description: "Lint a specific spec file",
      required: false,
    },
    preset: {
      type: "string",
      description: "Lint preset (minimal, recommended, strict)",
    },
  },
  async run({ args }) {
    const logger = createLogger({ quiet: args.quiet, verbose: args.verbose });

    if (args.fix) {
      logger.info("No auto-fixable issues supported yet.");
    }

    const results = await runLint({
      configDir: process.cwd(),
      specPath: args.path,
      preset: args.preset as any,
    });

    const formatter =
      args.format === "json" ? formatJson :
      args.format === "github" ? formatGithub :
      formatPretty;
    console.log(formatter(results.diagnostics));

    if (results.hasErrors) process.exit(1);
  },
});
```

- [ ] **Step 3: Implement validate command**

`packages/cli/src/commands/validate.ts`:
```typescript
import { defineCommand } from "citty";
import { loadConfig, ConfigError } from "@sdx/core";
import { sharedArgs } from "../shared-args.js";

export default defineCommand({
  meta: {
    name: "validate",
    description: "Validate spec.config.yaml",
  },
  args: { ...sharedArgs },
  async run() {
    try {
      const config = await loadConfig(undefined, process.cwd());
      console.log(`  ✓ Config valid. ${Object.keys(config.specs).length} specs defined.`);
    } catch (err) {
      if (err instanceof ConfigError) {
        console.error(`  ✗ Config invalid: ${err.message}`);
        if (err.errors) {
          for (const e of err.errors) {
            console.error(`    - ${JSON.stringify(e)}`);
          }
        }
        process.exit(1);
      }
      throw err;
    }
  },
});
```

- [ ] **Step 4: Implement graph command**

`packages/cli/src/commands/graph.ts`:
```typescript
import { defineCommand } from "citty";
import { loadConfig, buildGraph, GraphError } from "@sdx/core";
import { sharedArgs } from "../shared-args.js";

export default defineCommand({
  meta: {
    name: "graph",
    description: "Print the spec dependency graph",
  },
  args: {
    ...sharedArgs,
  },
  async run({ args }) {
    const config = await loadConfig(undefined, process.cwd());

    try {
      const graph = buildGraph(config);
      const sorted = graph.topologicalSort();

      if (args.format === "dot") {
        console.log("digraph specs {");
        for (const edge of graph.edges) {
          console.log(`  "${edge.from}" -> "${edge.to}";`);
        }
        console.log("}");
        return;
      }

      console.log("\n  Spec Dependency Graph:\n");
      for (const node of sorted) {
        const downstream = graph.getDownstream(node);
        const arrow = downstream.length > 0 ? ` → ${downstream.join(", ")}` : "";
        console.log(`  ${node}${arrow}`);
      }
      console.log("");
    } catch (err) {
      if (err instanceof GraphError) {
        console.error(`  ✗ ${err.message}`);
        process.exit(1);
      }
      throw err;
    }
  },
});
```

- [ ] **Step 5: Create formatters (pretty, json, github)**

`packages/cli/src/formatters/pretty.ts`:
```typescript
import type { Diagnostic } from "@sdx/lint";

export function formatPretty(diagnostics: Diagnostic[]): string {
  if (diagnostics.length === 0) return "  ✓ All specs pass lint checks.\n";

  return diagnostics
    .map((d) => {
      const icon = d.severity === "error" ? "✗" : d.severity === "warn" ? "⚠" : "ℹ";
      return `  ${icon} ${d.severity}  ${d.message}  (${d.ruleId})\n    ${d.filePath}${d.line ? `:${d.line}` : ""}`;
    })
    .join("\n");
}
```

`packages/cli/src/formatters/json.ts`:
```typescript
import type { Diagnostic } from "@sdx/lint";

export function formatJson(diagnostics: Diagnostic[]): string {
  return JSON.stringify(diagnostics, null, 2);
}
```

`packages/cli/src/formatters/github.ts`:
```typescript
import type { Diagnostic } from "@sdx/lint";

export function formatGithub(diagnostics: Diagnostic[]): string {
  return diagnostics
    .map((d) => {
      const level = d.severity === "error" ? "error" : "warning";
      const line = d.line ? `,line=${d.line}` : "";
      return `::${level} file=${d.filePath}${line}::${d.message} (${d.ruleId})`;
    })
    .join("\n");
}
```

- [ ] **Step 6: Create CLI index.ts**

`packages/cli/src/index.ts`:
```typescript
export { runLint } from "./commands/lint.js";
```

- [ ] **Step 7: Run all CLI tests**

Run: `pnpm build --filter=@sdx/schema --filter=@sdx/core --filter=@sdx/lint && cd packages/cli && pnpm test`
Expected: PASS

- [ ] **Step 8: Build and test the full CLI**

Run: `pnpm build && node packages/cli/dist/main.js --help`
Expected: Shows sdx help with init, lint, validate, graph subcommands

- [ ] **Step 9: Commit**

```bash
git add packages/cli/src/
git commit -m "feat(cli): add lint, validate, and graph commands with pretty/json/github formatters"
```

---

## Task 14: Templates

**Files:**
- Create: `templates/lightweight/spec.config.yaml`, `templates/lightweight/specs/prd.md`, `templates/lightweight/specs/technical-design.md`
- Create: `templates/bmad/spec.config.yaml`, `templates/bmad/specs/prd.md`, `templates/bmad/specs/technical-design.md`, `templates/bmad/specs/test-plan.md`
- Create: `templates/api-first/spec.config.yaml`, `templates/api-first/specs/technical-design.md`, `templates/api-first/specs/api-contract.md`, `templates/api-first/specs/test-plan.md`

- [ ] **Step 1: Create template files**

Templates are static reference examples. The `sdx init` command generates files dynamically (Task 12), but these templates serve as standalone examples users can copy.

Create each template directory with a valid `spec.config.yaml` and spec files following the patterns established in Task 12's template functions. Each spec file should have valid frontmatter and all required sections with helpful placeholder comments.

- [ ] **Step 2: Validate templates with sdx lint**

Run: `cd templates/lightweight && node ../../packages/cli/dist/main.js lint`
Expected: No errors (warnings acceptable for placeholder content)

Repeat for bmad and api-first templates.

- [ ] **Step 3: Commit**

```bash
git add templates/
git commit -m "feat: add lightweight, bmad, and api-first template directories"
```

---

## Task 15: Dogfooding & Documentation

**Files:**
- Create: `spec.config.yaml` (root — sdx's own config)
- Create: `specs/prd.md`, `specs/technical-design.md`, `specs/test-plan.md`
- Create: `README.md`

- [ ] **Step 1: Create sdx's own spec.config.yaml**

```yaml
version: "1.0"

project:
  name: "sdx"
  description: "Spec Developer Experience — opinionated tooling for spec-driven development with AI"

specs:
  prd:
    path: "specs/prd.md"
    type: "prd"
    required: true
  technical:
    path: "specs/technical-design.md"
    type: "technical-design"
    requires: ["prd"]
  test-plan:
    path: "specs/test-plan.md"
    type: "test-plan"
    requires: ["technical"]

lint:
  extends: "strict"
```

- [ ] **Step 2: Create sdx's own specs**

Write `specs/prd.md`, `specs/technical-design.md`, and `specs/test-plan.md` based on the content in `roadmap.md`. Each should have valid frontmatter and all required sections for its type. The content should describe sdx itself — this is dogfooding.

- [ ] **Step 3: Validate with sdx lint**

Run: `node packages/cli/dist/main.js lint`
Expected: Passes with strict preset (no errors). Warnings are acceptable and should be addressed.

- [ ] **Step 4: Write README.md**

Include:
- Project overview (from roadmap Vision section)
- Philosophy: spec-driven development, deterministic validation, skills-first AI integration
- Comparison to alternatives: why not just Markdown lint? why not just YAML schemas? What makes sdx different (dependency chains, context packing, drift detection)
- Installation: `npm install -g sdx`
- Quick start: `sdx init`, `sdx lint`, `sdx graph`
- Spec file format example
- Config example
- Schema versioning section: explain that schemas use semver via the `version` field in `spec.config.yaml`, individual specs are versioned independently via frontmatter `version`, and schema migrations will be handled by `sdx migrate` (Phase 4). Breaking schema changes bump the config `version` field.
- Contributing section: how to write custom lint rules (implement `LintRule` interface, export as default), how to contribute spec type schemas (add JSON Schema + type + validator entry), how to submit changes (fork, branch, PR)

- [ ] **Step 5: Write CONTRIBUTING.md**

Create `CONTRIBUTING.md` covering:
- Development setup (`pnpm install`, `pnpm build`, `pnpm test`)
- How to write a custom lint rule with a complete example
- How to add a new spec type schema
- PR process and coding standards

- [ ] **Step 5: Commit**

```bash
git add spec.config.yaml specs/ README.md CONTRIBUTING.md
git commit -m "feat: add sdx's own spec suite (dogfooding), README, and contributing guide"
```

- [ ] **Step 6: Final integration test**

Run from repo root:
```bash
pnpm build
pnpm test
node packages/cli/dist/main.js validate
node packages/cli/dist/main.js lint
node packages/cli/dist/main.js graph
```

Expected: All pass. CLI commands produce correct output for sdx's own spec suite.

- [ ] **Step 7: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: final integration fixes for Phase 1"
```

---

## Task 16: ESLint + Prettier Setup

**Files:**
- Create: `eslint.config.js`
- Create: `.prettierrc`
- Modify: `package.json` (root — add lint:code and format scripts)

- [ ] **Step 1: Install ESLint and Prettier**

Run:
```bash
pnpm add -D eslint @eslint/js typescript-eslint prettier eslint-config-prettier
```

- [ ] **Step 2: Create eslint.config.js (flat config)**

`eslint.config.js`:
```javascript
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    ignores: ["**/dist/**", "**/node_modules/**", "**/*.js", "!eslint.config.js"],
  },
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);
```

- [ ] **Step 3: Create .prettierrc**

`.prettierrc`:
```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 4: Add scripts to root package.json**

Add to `scripts`:
```json
"lint:code": "eslint packages/*/src/",
"format": "prettier --write \"packages/*/src/**/*.ts\"",
"format:check": "prettier --check \"packages/*/src/**/*.ts\""
```

- [ ] **Step 5: Run lint and format to verify**

Run: `pnpm lint:code && pnpm format:check`
Expected: Passes (fix any issues that come up)

- [ ] **Step 6: Commit**

```bash
git add eslint.config.js .prettierrc package.json
git commit -m "chore: add ESLint + Prettier configuration"
```

---

## Task 17: Changesets for Versioning

**Files:**
- Create: `.changeset/config.json`
- Modify: `package.json` (root — add changeset scripts)

- [ ] **Step 1: Install changesets**

Run: `pnpm add -D @changesets/cli`

- [ ] **Step 2: Initialize changesets**

Run: `pnpm changeset init`

- [ ] **Step 3: Update .changeset/config.json**

`.changeset/config.json`:
```json
{
  "$schema": "https://unpkg.com/@changesets/config@3.1.1/schema.json",
  "changelog": "@changesets/cli/changelog",
  "commit": false,
  "fixed": [],
  "linked": [],
  "access": "public",
  "baseBranch": "main",
  "updateInternalDependencies": "patch",
  "ignore": []
}
```

- [ ] **Step 4: Add scripts to root package.json**

Add to `scripts`:
```json
"changeset": "changeset",
"version": "changeset version",
"release": "pnpm build && changeset publish"
```

- [ ] **Step 5: Commit**

```bash
git add .changeset/ package.json
git commit -m "chore: add changesets for versioning and publishing"
```

---

## Task 18: CI Pipeline (GitHub Actions)

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Create CI workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"

      - run: pnpm install --frozen-lockfile

      - run: pnpm build

      - run: pnpm typecheck

      - run: pnpm lint:code

      - run: pnpm format:check

      - run: pnpm test
```

- [ ] **Step 2: Create release workflow**

`.github/workflows/release.yml`:
```yaml
name: Release

on:
  push:
    branches: [main]

concurrency: ${{ github.workflow }}-${{ github.ref }}

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      packages: write
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"
          registry-url: "https://registry.npmjs.org"

      - run: pnpm install --frozen-lockfile

      - run: pnpm build

      - name: Create Release Pull Request or Publish
        uses: changesets/action@v1
        with:
          publish: pnpm release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

- [ ] **Step 3: Commit**

```bash
git add .github/
git commit -m "ci: add GitHub Actions workflows for CI and release"
```

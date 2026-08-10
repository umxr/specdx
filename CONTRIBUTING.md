# Contributing to specdx

Thank you for your interest in contributing. This guide covers development setup, how to extend
specdx with custom lint rules, how to add new spec type schemas, and the PR process.

---

## Development Setup

### Prerequisites

- Node.js 18 or later
- pnpm 9 or later (`npm install -g pnpm`)

### Clone and install

```bash
git clone https://github.com/umxr/specdx.git
cd specdx
pnpm install
```

### Build all packages

```bash
pnpm build
```

Turborepo builds packages in dependency order. Incremental builds are cached; only changed
packages are rebuilt on subsequent runs.

### Run the test suite

```bash
pnpm test
```

Runs Vitest across all packages. To run tests for a single package:

```bash
cd packages/lint
pnpm test
```

To run tests in watch mode:

```bash
pnpm test --watch
```

### Run the CLI locally

```bash
node packages/cli/dist/main.js lint
node packages/cli/dist/main.js validate
node packages/cli/dist/main.js graph
```

Or link the CLI globally after building:

```bash
cd packages/cli
npm link
specdx lint
```

### Linting and formatting

specdx uses ESLint and Prettier. Run checks with:

```bash
pnpm lint:code
pnpm format:check
```

Auto-format:

```bash
pnpm format
```

---

## Writing a Custom Lint Rule

Custom rules let you enforce project-specific conventions without modifying specdx itself.

### The `LintRule` interface

```typescript
interface LintRule {
  id: string;          // e.g. "myorg/require-jira-ticket"
  description: string;
  severity: "error" | "warn" | "info";
  run(context: LintContext): Diagnostic[];
}

interface LintContext {
  spec: ParsedSpec;
  allSpecs: ParsedSpec[];
  config?: SdxConfig;
  graph?: DependencyGraph;
}

interface Diagnostic {
  ruleId: string;
  severity: "error" | "warn" | "info";
  message: string;
  filePath: string;
  line?: number;
  section?: string;
}
```

### Example: require a Jira ticket in PRD frontmatter

Create a file, for example `rules/require-jira-ticket.js`:

```javascript
/** @type {import('@specdx/lint').LintRule} */
const rule = {
  id: "myorg/require-jira-ticket",
  description: "PRDs must have a Jira ticket ID in their frontmatter",
  severity: "error",
  run(context) {
    if (context.spec.frontmatter.type !== "prd") return [];
    if (context.spec.frontmatter.jira_ticket) return [];
    return [
      {
        ruleId: "myorg/require-jira-ticket",
        severity: "error",
        message: "PRD is missing a jira_ticket field in frontmatter",
        filePath: context.spec.filePath,
      },
    ];
  },
};

export default rule;
```

### Loading custom rules

Reference the rule file in `spec.config.yaml`:

```yaml
lint:
  extends: "recommended"
  rules:
    myorg/require-jira-ticket: ["error", { path: "./rules/require-jira-ticket.js" }]
```

The rule file must export the rule object as `default`. CommonJS (`module.exports = rule`) and
ESM (`export default rule`) are both supported.

### Rule IDs

Use a namespaced ID of the form `namespace/rule-name`. The namespace avoids collisions with
built-in rules. Built-in namespaces are `structure/`, `completeness/`, `consistency/`,
`clarity/`, `freshness/` and `security/`.

---

## Adding a New Spec Type Schema

To add support for a new spec type (e.g. `runbook`):

### 1. Add the JSON Schema

Create `packages/schema/src/schemas/runbook.json`:

```json
{
  "$id": "runbook",
  "$schema": "http://json-schema.org/draft-07/schema#",
  "allOf": [
    { "$ref": "base-spec" },
    {
      "type": "object",
      "properties": {
        "type": { "const": "runbook" }
      },
      "required": ["type"]
    }
  ]
}
```

### 2. Register the type

Add `"runbook"` to the `type` enum in `packages/schema/src/schemas/base-spec.json`:

```json
"type": {
  "type": "string",
  "enum": ["prd", "technical-design", "user-story", "test-plan", "adr",
           "api-contract", "epic", "quick-spec", "project-context", "runbook"]
}
```

Also add `"runbook"` to the `type` enum in `packages/schema/src/schemas/config.json` under
`specs.additionalProperties.properties.type`.

### 3. Export the TypeScript type

In `packages/schema/src/types.ts`, add `"runbook"` to the `SpecType` union:

```typescript
export type SpecType =
  | "prd"
  | "technical-design"
  | "user-story"
  | "test-plan"
  | "adr"
  | "api-contract"
  | "epic"
  | "quick-spec"
  | "project-context"
  | "runbook";
```

### 4. Register the validator

In `packages/schema/src/validator.ts`, add the schema to the AJV instance alongside the other
spec type schemas.

### 5. Define required sections

In `packages/schema/src/sections.ts`, add an entry to `REQUIRED_SECTIONS`:

```typescript
runbook: ["Overview", "Prerequisites", "Steps", "Rollback", "Verification"],
```

### 6. Add tests

Add fixture files and test cases in `packages/schema/src/schemas.test.ts` and
`packages/lint/src/rules/structure-rules.test.ts` covering:

- Valid runbook passes schema validation.
- Runbook missing required sections is flagged.
- Unknown fields are handled per `additionalProperties` setting.

### 7. Rebuild and test

```bash
pnpm build
pnpm test
```

---

## PR Process

1. **Fork** the repository and create a branch from `main`:

   ```bash
   git checkout -b feat/my-feature
   ```

2. **Make your changes.** Follow the conventions in the existing codebase (TypeScript, ESM imports
   with `.js` extensions, Vitest for tests).

3. **Add tests** for any new behaviour. PRs without tests for new features will not be merged.

4. **Run the full suite** and ensure everything passes:

   ```bash
   pnpm build && pnpm typecheck && pnpm lint:code && pnpm format:check && pnpm test
   ```

5. **Add a changeset** describing your change (required for anything that affects published packages):

   ```bash
   pnpm changeset
   ```

   Follow the prompts to select the affected packages and describe the change.

6. **Open a PR** against `main`. Fill in the PR template with:
   - What the change does and why.
   - How it was tested.
   - Any breaking changes.

7. **Address review feedback.** A maintainer will review the PR, leave comments, and approve or
   request changes.

---

## Code Conventions

- All packages are TypeScript with `"moduleResolution": "NodeNext"`, `strict` mode, and ESM output.
- Import paths within a package use the `.js` extension (required for ESM compatibility).
- Tests live alongside source files as `*.test.ts`.
- Use `describe` / `it` / `expect` from Vitest. No `test()` top-level calls.
- Prefer explicit return types on exported functions.
- No `any` without a comment explaining why.

---

## Questions

Open a GitHub Discussion or file an issue. For security disclosures, see `SECURITY.md`.

---
name: sdx:start-task
description: Load project spec context for a coding task using sdx pack
---

# sdx:start-task

You are about to begin a coding task within a project that uses **SDX (Spec Developer Experience)** to manage its specifications. SDX specs are structured markdown documents (RFCs, ADRs, runbooks, designs, etc.) that capture project decisions, architecture, and conventions.

Your job is to load relevant spec context before starting work, so you have the full picture of what the project expects.

## Step 1: Pack the context

Run the following command, replacing `<task-description>` with the user's task description:

```bash
sdx pack --task "<task-description>" --format xml
```

This will:
- Scan the project's `specs/` directory (or configured spec paths)
- Identify specs relevant to the task description using keyword matching and dependency analysis
- Compress stale or resolved specs to save context tokens
- Output a structured XML document with all relevant spec content

### Alternative formats

If XML is too verbose for the model's context window, you can try:

```bash
sdx pack --task "<task-description>" --format markdown
```

Or for a minimal structured output:

```bash
sdx pack --task "<task-description>" --format json
```

### Limiting token budget

If the context is too large, you can set a token budget:

```bash
sdx pack --task "<task-description>" --format xml --budget 8000
```

## Step 2: Read and internalize the packed context

After running `sdx pack`, read the output carefully. The packed context includes:

### Spec metadata
Each spec entry contains:
- **id**: Unique identifier (e.g., `rfc-001`, `adr-012`)
- **type**: The spec type (`rfc`, `adr`, `runbook`, `design`, `standard`, `custom`)
- **title**: Human-readable title
- **status**: Current lifecycle status (`draft`, `review`, `accepted`, `superseded`, `deprecated`, `withdrawn`)
- **dependencies**: Other specs this one references or depends on

### Spec sections
Each spec is broken into its constituent sections (e.g., Context, Decision, Consequences for an ADR). Sections from stale specs may be compressed to save tokens — these will be marked with a compression notice.

### Collapsed specs
Some specs may be fully collapsed to a one-line summary (e.g., superseded ADRs). This is intentional — they provide awareness without consuming significant context.

## Step 3: Apply the context to your task

When working on the task, you MUST:

1. **Reference specs by ID** — When your implementation relates to a spec, mention it explicitly (e.g., "Per ADR-012, we use PostgreSQL for persistence").

2. **Flag drift** — If you notice the codebase diverges from what a spec describes, call it out:
   - "NOTE: The code uses Redis here, but ADR-012 specifies PostgreSQL. This may be intentional drift or the ADR may need updating."

3. **Note gaps** — If the task requires decisions not covered by any spec, say so:
   - "GAP: No spec covers error retry strategy for this service. Consider authoring an ADR."

4. **Respect status** — Treat spec statuses appropriately:
   - `accepted` / `active`: These are current truth. Follow them.
   - `draft` / `review`: These are proposed but not finalized. Follow them tentatively but note they may change.
   - `superseded`: Check what supersedes it. Follow the newer spec.
   - `deprecated` / `withdrawn`: Do not follow these. Note if code still references them.

5. **Follow conventions** — Standards and runbooks often define coding conventions, naming patterns, deployment procedures, etc. Adhere to them.

## Step 4: Verify spec alignment before finishing

Before completing the task, do a quick check:

- [ ] Does the implementation align with all relevant accepted specs?
- [ ] Are there any specs in `draft` or `review` that this work might affect?
- [ ] Did you introduce any patterns not covered by existing specs?
- [ ] If you found drift or gaps, did you document them in your response?

## Troubleshooting

### `sdx pack` returns no specs
- Check that the project has an `sdx.config.ts` or `sdx.config.yaml` file
- Verify specs exist in the configured `specsDir` (default: `specs/`)
- Try a broader task description — the relevance matcher uses keywords from spec titles and content

### `sdx pack` returns too many specs
- Use `--budget` to limit token count
- Make the task description more specific
- The packer prioritizes by relevance score; lower-scored specs are trimmed first

### Specs seem outdated
- Check `updatedDate` in spec frontmatter
- Run `sdx lint` to identify specs with structural or content issues
- Suggest the user update stale specs

### Command not found
- Ensure `specdx` is installed: `npm install -g specdx` or `npx specdx pack ...`
- In a monorepo, it may be a devDependency: `npx sdx pack ...`

## Understanding the output formats

### XML format (recommended for Claude)

The XML format wraps specs in tags that are easy for LLMs to parse:

```xml
<sdx-context task="Add pagination to /api/users" specs="4" tokens="3200">
  <spec id="rfc-003" type="rfc" status="accepted" title="REST API Design Guidelines">
    <section heading="Pagination">
      All list endpoints MUST support cursor-based pagination...
    </section>
  </spec>
  <spec id="adr-002" type="adr" status="superseded" collapsed="true">
    [ADR] Use Express.js — superseded
  </spec>
</sdx-context>
```

Key attributes:
- `specs` — total number of specs included
- `tokens` — estimated token count of the full output
- `collapsed="true"` — spec was reduced to a one-liner

### Markdown format

The markdown format uses headings and horizontal rules to separate specs:

```markdown
# SDX Context: Add pagination to /api/users

---

## rfc-003: REST API Design Guidelines
**Type:** rfc | **Status:** accepted

### Pagination
All list endpoints MUST support cursor-based pagination...

---

## adr-002: Use Express.js
> [ADR] Use Express.js — superseded
```

### JSON format

The JSON format is compact and machine-parseable:

```json
{
  "task": "Add pagination to /api/users",
  "specs": [
    {
      "id": "rfc-003",
      "type": "rfc",
      "status": "accepted",
      "title": "REST API Design Guidelines",
      "sections": [{ "heading": "Pagination", "content": "..." }]
    }
  ]
}
```

## How relevance scoring works

The packer uses multiple signals to rank spec relevance:

1. **Keyword overlap** — Words from the task description are matched against spec titles, tags, and section headings. More matches = higher score.
2. **Type affinity** — ADRs and standards are weighted slightly higher because they represent binding decisions and rules.
3. **Status weighting** — `accepted` and `active` specs score higher than `draft` or `deprecated` ones.
4. **Dependency inclusion** — If a high-relevance spec depends on another spec, the dependency is pulled in automatically (transitive closure).
5. **Recency boost** — Recently updated specs get a small relevance boost.

Specs below the relevance threshold are excluded entirely unless they are transitive dependencies of included specs.

## Example session

User says: "Add pagination to the /api/users endpoint"

1. Run: `sdx pack --task "Add pagination to the /api/users endpoint" --format xml`
2. Read the output — you might see:
   - `rfc-003: REST API Design Guidelines` (status: accepted) — defines pagination patterns
   - `adr-007: Use cursor-based pagination` (status: accepted) — specific decision
   - `standard-001: API Response Envelope` (status: active) — response format requirements
   - `adr-002: Use Express.js` (status: superseded) — collapsed, just for awareness
3. Implement pagination following the cursor-based approach from ADR-007
4. Use the response envelope format from standard-001
5. Follow the REST conventions from RFC-003
6. Note in your response: "Implemented per ADR-007 (cursor-based pagination) and standard-001 (envelope format)"

## Example: handling drift

User says: "Refactor the auth middleware to use JWT"

1. Run: `sdx pack --task "Refactor auth middleware to use JWT" --format xml`
2. Output includes:
   - `adr-003: Use session-based authentication` (status: accepted)
   - `standard-002: Security Standards` (status: active)
3. The task asks for JWT, but ADR-003 says session-based auth is the accepted approach.
4. Respond with: "DRIFT: This task requests JWT-based auth, but ADR-003 (accepted) specifies session-based authentication. Before proceeding, we should either: (a) create a new ADR superseding ADR-003 to adopt JWT, or (b) confirm this is a deliberate exception."
5. Do NOT silently ignore the spec. Always surface the conflict.

## Example: noting gaps

User says: "Add rate limiting to the API gateway"

1. Run: `sdx pack --task "Add rate limiting to the API gateway" --format xml`
2. Output includes general API specs but nothing about rate limiting specifically.
3. Respond with: "GAP: No spec covers rate limiting strategy (algorithm, limits, response codes, retry headers). Recommend authoring an ADR before implementation to align on approach. In the meantime, proceeding with token bucket algorithm at 100 req/min as a reasonable default."

## Notes

- The `sdx pack` command is read-only — it never modifies specs or project files
- Token counts in the output are estimates based on the `cl100k_base` tokenizer
- Compressed sections can be expanded by re-running without `--budget` or with a larger budget
- If a spec has `dependencies`, the packer automatically includes those transitive dependencies
- The packer respects `.sdxignore` patterns if present in the project root
- Multiple `--task` flags are not supported; combine related work into one description
- The `--format` flag defaults to `xml` if omitted

## When NOT to use this skill

- For simple, self-contained tasks that don't touch architecture or conventions (e.g., fixing a typo)
- When the user explicitly says to skip spec context
- When running in a project that doesn't use SDX (no `sdx.config.*` file)
- For tasks that only modify tests without changing production behavior

In those cases, proceed directly with the task without running `sdx pack`.

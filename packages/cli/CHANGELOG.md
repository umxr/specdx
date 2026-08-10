# specdx

## 0.4.0-alpha.22

### Minor Changes

- 8f153a3: fix: repair every defect found by the fifth audit run

  Audit run 5 confirmed all five run-4 fixes hold on every surface. It found one blocker and eight lesser defects, all fixed here.

  **F1 (blocker) — the GitHub Action passed green when it checked zero specs.** The job's verdict read only the diagnostics array, so a config whose spec paths resolved to no files produced no diagnostics and a successful job that enforced nothing. Every CLI command already guarded this; the one surface that gates CI did not. This is the vacuous-pass class re-opening: the 2026-07-30 pass fixed the Action's PR-comment renderer and declared the class closed, and the comment renderer turned out to be unreachable code.

  **F2 (medium) — `--format`, `--quiet` and `--verbose` were advertised on every command and honoured by few.** One blanket `sharedArgs` object gave nine commands a `--format` help text listing `github` while two implemented it; `validate` and `graph` ignored `--format` entirely; an unknown value fell through to pretty output with exit 0; and `--quiet` only lowered a log level while every line went out through `console.log`. Commands now declare the formats they render, an unsupported value is an error naming the supported set, `validate` and `graph` gained real JSON, `check` gained GitHub annotations, `graph --format dot` is documented, and `--quiet` suppresses success and summary output while problems still print.

  **F3 (medium) — the published `index.d.ts` exported five functions and none of their types.** `import type { PackResult } from "specdx"` failed with TS2459, so a consumer could call the API and then not annotate what it returned.

  **F4 (medium) — the `specCount` → `specFiles` rename had landed on MCP only.** CLI `status` reported `specCount` meaning spec files while `runValidate` used the same name for config entries. Renamed to `specFiles` and `specEntries` across the CLI and the library, matching MCP.

  **F5–F8 (low).** Info diagnostics render as `::notice` rather than `::warning`, so an advisory no longer reports as a warning on a clean suite. `check --verbose` says artifacts were "assessed" rather than "verified", which contradicted the failure printed two lines below. `check --ai` without a key prints a formatted error instead of an uncaught stack trace. `runStatus` and `runDiff` accept a `configDir` like `runLint` and `runPack`.

  **F9 — `completeness/edge-case-coverage` could never fire on a test plan.** It substring-matched "edge case" over the whole document while the type requires an `## Edge Cases` heading, so the required scaffolding satisfied the rule. It now judges the section's content. User-story behaviour is unchanged.

## 0.4.0-alpha.21

### Patch Changes

- de09f31: Repair every defect found by the fourth audit run (against 0.4.0-alpha.20).
  - **N1 (regression from the strict-preset fix):** `--preset strict` no longer fails every suite in an environment that carries `ANTHROPIC_API_KEY`. Strict promotes warn rules to error and leaves info-class advisories (`clarity/ambiguity-score-ai`) at info — an advisory a spec edit cannot satisfy must never fail the build.
  - **N2:** `check`'s coverage score no longer barely moves when a whole type is missing. The types denominator counts fields, so the single finding for a wholly-missing type now carries its field count as `weight` and the score subtracts it. A project implementing nothing of a 5-field model scores 0 for types, not 80%.
  - **N3:** no shipped string names a bare `sdx` binary. The first-run error now says `Run 'specdx init'`, the ambiguity advisory says `specdx check --ai`, the `check`/`update` headlines and the `--ai` failure message name `specdx`, and the config schema `$id` is `specdx-config`. A packaging test greps every packed `.js`/`.md` file so the class stays closed.
  - **N4:** `runLint`, `runPack` and `scaffoldProject` now fail with a message naming the missing required option (`configDir` / `targetDir`) instead of an `ERR_INVALID_ARG_TYPE` stack trace from inside `path.join`.
  - **N5 (found re-verifying N2):** without ts-morph, type matching now skips like test matching does — unless a Prisma schema keeps types assessable. Previously every spec'd type was matched against an empty extraction and reported unimplemented when it was never looked at.

## 0.4.0-alpha.20

### Minor Changes

- 9d70a5a: fix: repair every defect found by the third pre-stable audit

  Six defects, found by driving the published `0.4.0-alpha.19` tarball through seven sandbox projects, an MCP stdio client and the GitHub Action under `act`. The first had never worked in any release.

  **`lint --preset strict` was a complete no-op.** `getPreset("strict")` rewrote each rule's `severity`, and the engine never read it — it collected whatever diagnostic objects the rules returned, and ten of the thirteen rules hardcoded `severity: "warn"` in the diagnostic they emitted. `strict` therefore produced output byte-identical to `recommended` on the CLI, in `extends:`, in the Action's `preset` input and in `runLint({ preset })`, so a CI gate written against it never failed. The engine now stamps the rule's declared severity onto the diagnostics that rule returned. The preset test asserted on `rule.severity` — the field nothing consumed — and now asserts on emitted diagnostics and on `hasErrors`.

  **`check` threw a stack trace when a test plan met a missing `ts-morph`.** Route and type extraction degraded to a note; test extraction was called unguarded, so one test-plan spec turned the intended skip into an unhandled error — on exactly the ephemeral-runner path the note describes, and through MCP's `sdx_check`, where the bare exception became the tool's only output. All three categories are guarded now, and the note names all three.

  **The Prisma extractor could not see a Prisma project's schema.** It read `<root>/schema.prisma` only, and `prisma init` writes `prisma/schema.prisma`. Every model was reported unimplemented and the coverage score dropped to match, with nothing said. It now reads `prisma/schema.prisma`, the project root, and the multi-file `prisma/schema/` directory, and `check` notes when a Prisma dependency is declared but no schema was found. The same shape is fixed for Next.js: `extractNextjsRoutes` defaulted to `app` alone, so `src/app` projects scanned an absent directory and reported no routes.

  **Story coverage reported a green check over a feature with no story.** A feature counted as covered at 34 % word overlap, so "Export the payroll report as PDF" was satisfied by a story about the invoice report. `lint` said nothing, `ready` asserted "All PRD features have corresponding stories", and `generate story` refused to stub the missing one — one loose threshold, three wrong answers. A story must now also pick up more than half of the words that set a feature apart from its siblings; where nothing distinguishes them, or nothing is shared, the threshold decides alone as before.

  **A type declared as a markdown table was dropped in silence.** The "no fields recognised" note fires per spec, so one readable type hid every unreadable one beside it. Tables are now read as fields when the header names a field column and a type column, and a type whose table still cannot be read is named in its own note. A heading with no field declarations at all remains prose, deliberately.

  **A test suggestion carried the spec's own markup.** An unmatched case was reported as `Add a test matching: "**TC5**: …"`. The case ID is now lifted into `SpecTestCase.id`, kept on the finding's `expected` so it stays traceable to a line in the test plan, and left out of the test name a user is asked to write.

## 0.4.0-alpha.19

### Patch Changes

- 4928107: Repair every defect found by the audit re-run against the published alpha.18.

  **`check` now reads a bulleted Endpoints section.** `parseEndpoints` accepted
  only `### METHOD /path` headings, so an api-contract written as a list parsed to
  zero endpoints: routes left the coverage denominator, every implemented route
  was reported as unspecified, and a genuinely absent endpoint was never
  mentioned — while the score _rose_, because understanding less removed the
  category. A populated section that still yields nothing now produces a note, the
  way an unreadable Data Model already did. Both micro-formats are documented in
  the README and the author-spec skill for the first time.

  **The plugin's SessionStart hook runs the CLI it ships with.** It resolved
  `specdx` from `PATH` (else `npx --yes specdx`), so a stale global install
  answered and its "config invalid" was injected into the session as fact. It now
  prefers `${CLAUDE_PLUGIN_ROOT}/dist/main.js`, then the project's own
  devDependency, and caps the graph it injects rather than growing with the suite.

  **`generate test-plan` no longer destroys hand-written specs.** It overwrote an
  approved, registered test plan with a draft stub, silently, with exit 0. It now
  refuses unless given `--force`, and only suggests a config key when the file is
  not already registered.

  **`generate story` and the lint rule agree about what a feature is.** The
  generator kept its own regex requiring `**F<N>**:`, so the same PRD produced
  three features in `lint` and `ready` and none in the generator. Both now call
  `parseFeatureEntries`.

  Also fixed:
  - A `###` sub-heading inside a Data Model no longer becomes a phantom type: a
    block earns its place by declaring at least one field and naming a single
    identifier, so `### Notes on the model` is prose again rather than a type
    called `Notes` that `check` demanded code implement.
  - The published package ships `dist/index.d.ts`, with the bundled `@specdx/*`
    types inlined so no declaration imports a package that was never published.
  - Every package lists `types` first in its `exports` map — after `import`, the
    condition was never reached, so declarations could be present and still not
    be found.
  - New `structure/id-matches-config-key` rule: a spec whose frontmatter `id`
    differs from its config key is named directly, instead of surfacing as
    dangling-reference errors against the specs that referenced it.
  - `completeness/edge-case-coverage` recognises any 4xx/5xx status code and
    words like "conflict" and "denied". It knew only `404` and `500`, so a story
    whose error path was a 409 read as having no error handling at all.
  - The MCP server reports the real package version instead of a hardcoded
    `0.4.0`, and `sdx_status` drops the ambiguous `specCount` alongside
    `specFiles`.
  - Shipped skills name the `specdx` binary, not the `sdx` one that does not
    exist.
  - Nested sub-command help no longer repeats its parent (`generate generate
story`).
  - `migrate` reports a config `version` it does not support instead of printing
    it and declaring no migration needed.
  - `specdx init` defaults the project name to the target directory, so the first
    command a new user runs no longer fails on a missing flag.

## 0.4.0-alpha.18

### Minor Changes

- 90a10a8: fix: repair every defect found by the pre-stable audit

  A full audit of the published tarball across five sandbox projects found
  fourteen defects. Three shipped broken to users and none could fail a unit test.

  **The GitHub Action could not run at all.** Its entrypoint was gitignored, so it
  existed in no commit GitHub could check out; the build was `tsc` output that
  kept bare specifiers a runner cannot resolve; the README pointed at
  `umxr/specdx-action`, a repository that does not exist; and it documented a
  `preset` input the action never declared. The action is now bundled to a single
  committed CJS file, `preset` is implemented, the README points at the real path,
  and a workflow runs the action in a container on every push.

  **The plugin's SessionStart hook exited 126.** npm normalises non-`bin` files to
  644 when packing, so a manifest that executed the script directly failed for
  every plugin user. It is now invoked through an interpreter.

  **The published package had no README**, so the npm page was blank. It is now
  copied into the package at build time.

  Also fixed: frontmatter errors that named neither field nor allowed values;
  `story-coverage`, which warned on every real suite and passed silently on
  non-conforming ones; `check` silently ignoring a Data Model whose fields were
  not backticked, and `update` then telling authors to add fields already present;
  `generate test-plan` writing an empty spec and calling it success;
  `generate story` re-stubbing features that already had stories; `diff` leaking a
  raw git error outside a repository; `ts-morph` undeclared as an optional peer;
  ambiguous `specCount` across two MCP tools; and a README that documented three
  spec types as freeform when the linter hard-fails them.

  Each fix carries a regression test, and the packaging and documentation defects
  are now covered by assertions against the packed artifact and the README itself.

## 0.4.0-alpha.17

### Minor Changes

- c6920d6: refactor: drop the `explain` command

  **Breaking:** `specdx explain` is removed, along with the programmatic `runExplain` export.

  It summarised each spec by its first non-empty line, which on a freshly scaffolded suite is the template's `<!-- placeholder -->` comment — so the one command meant to orient a new developer described every spec as a placeholder. Everything it reported is already available and correct elsewhere: `status --format json` for the project name, counts, statuses and health, `graph` for how specs relate, and `pack --full` for the content itself. The `specdx-onboard` skill now drives that sequence.

  0.x is the last cheap moment to remove a command; after a stable release it breaks users.

### Patch Changes

- d58623d: refactor: promote CLI commands by folder

  Command modules now live in `core/` or `experimental/` buckets, and the
  `[experimental]` caveat is derived from the bucket at render time rather than
  typed into each description. No file under `commands/` spells the marker any
  more, so the folder and the label cannot disagree.

  Sub-commands carry their own bucket: `generate` is promoted, `generate
test-plan` is not, and the caveat now reaches it from its own folder instead of
  a hand-written string.

  Nothing changes for a user — `--help` renders the same labels — but the
  conformance test now fails when a command's promotion drifts from how it
  describes itself, including in the README's CLI reference. This is the drift
  that quietly moved `explain` and `changelog` into the core surface.

- 40d0fd5: fix(pack): stop collapsing stale specs when the budget has room for them

  `pack` compressed every spec untouched for `stable_days` (7 by default) before
  it ever consulted the budget, so a suite that fitted comfortably still came back
  as `[Unchanged since … — N tokens omitted]` stubs. On specdx's own specs that
  meant 1,457 of 12,000 tokens used and 20 sections stubbed, when the whole suite
  fits in 8,056. Specs that have not changed in a week are the normal case, so the
  default configuration degraded almost every real suite — silently, since
  `used=1457 budget=12000 omitted=0` reads like a healthy pack.

  The staleness collapse is now a response to budget pressure: full content is
  used when it fits, and stale specs collapse from least relevant upward only
  until the suite fits. Boilerplate stripping and superseded-ADR collapse are
  unchanged — those are hygiene at any budget.

  Fixes #33.

## 0.4.0-alpha.16

### Minor Changes

- f65daf9: feat(skills): promote by folder, add a router, and state what success looks like

  Skills now live in bucket folders where the bucket _is_ the promotion: `core/` is what the Claude Code plugin ships and what `specdx skills install` writes; `experimental/` holds the two skills built on `sdx check` and installs only with `--experimental`. Promotion was previously an `[experimental]` string in a description — the same mechanism that let `explain` and `changelog` drift into the core CLI surface.

  New `specdx-router` skill (user-invoked) maps the workflows and the distinctions that are easy to get wrong. Every skill now ends with an **"It's working if"** section — a falsifiable success signal, so a skill can be judged to have failed.

  **Fixed:** `turbo.json` did not list skill markdown as a build input, so editing a skill did not invalidate the CLI build cache and could ship stale (#30).

  `scripts/link-skills.sh` symlinks source skills into `~/.claude/skills` for dogfooding without a rebuild.

## 0.4.0-alpha.15

### Minor Changes

- a6cb2f1: feat(skills): conform to the Agent Skills specification

  Skills shipped as flat markdown files installed to `.claude/commands/`, which made them slash commands rather than skills. They now follow [agentskills.io/specification](https://agentskills.io/specification):
  - Each skill is a directory containing `SKILL.md`, with `name` matching the directory.
  - Bundled resources move to `references/` — the `specdx-author-spec` step files and the shared spec-type reference.
  - `allowed-tools` is a space-separated string, not comma-separated, and uses Claude Code prefix syntax (`Bash(npx specdx:*)`).
  - `specdx skills install` writes to `.claude/skills/<name>/SKILL.md` and copies bundled resources.
  - The Claude Code plugin manifest declares `skills` instead of `commands`, and drops a hand-maintained `version` that had drifted 13 releases behind.

  **Breaking:** skills previously installed under `.claude/commands/` are not removed. Delete the old `specdx-*.md` files there after upgrading.

### Patch Changes

- 55eb27b: fix(plugin): repair the hooks manifest and keep plugin versions in sync

  `claude plugin validate --strict` failed: `hooks.json` used an array where the schema expects a record keyed by event name, and `plugin.json` never referenced it — so the `SessionStart` hook never loaded for plugin users. The hook path now uses `${CLAUDE_PLUGIN_ROOT}`.

  Plugin manifest versions were hand-maintained and had drifted: the Claude manifest carried none and the Cursor manifest was 13 releases behind. `scripts/sync-plugin-version.mjs` now stamps them during `changeset version`, and `pnpm check-plugin-version` guards it in CI.

## 0.4.0-alpha.14

### Minor Changes

- 22a94b0: refactor: narrow the core command surface to the focus decision

  **Breaking:** the `specdx changelog` command is removed. It ran the same comparison as `diff` and differed only in presentation, so it is now a format: `specdx diff --format changelog`. `--from`/`--to` become `--base`/`--head`, and the programmatic `runChangelog` export is gone. The changelog output now also carries the uncommitted-specs warning, which matters most at release time.

  `specdx explain` is flagged `[experimental]` until its output earns a core slot.

  This takes the core surface from 13 commands to 11, so every core command traces back to the context-engine focus decision rather than to drift.

## 0.4.0-alpha.13

### Minor Changes

- b657e67: feat(lint): flag placeholder sections, and stop declaring a scaffold READY

  `specdx init` produced specs whose every section was `<!-- placeholder -->`, and `lint`, `status` and `ready` all passed them — `structure/required-sections` checks that a heading exists, never that anything was written under it.

  New rule `completeness/no-placeholder-sections` (severity `warn`) flags sections whose body is empty or only a placeholder marker, matched against the whole body so prose mentioning a TODO is untouched. `ready` gains a "Specs have content" check that fails on them, since `ready` gates on errors and a warning alone would not block the verdict.

### Patch Changes

- aa06215: fix(mcp): ship the MCP server's runtime dependencies

  `specdx mcp` failed with `ERR_MODULE_NOT_FOUND` for every npm install. `@modelcontextprotocol/sdk` and `zod` were marked external in the bundle and declared only on the unpublished `@specdx/mcp` package, so nothing supplied them at runtime. They are now dependencies of `specdx`, the import failure reports an actionable message instead of a raw stack trace on the stdio transport, and a packaging test asserts every external is either declared or an allowlisted optional dependency.

- 95ff07d: fix(pack): report when nothing was packed instead of emitting an empty context

  `pack` wrote an empty `<context>` to stdout and exited 0 when no spec was selected, which reads as a successful pack to whatever consumes it. It now explains why — config resolved nothing, everything scored below the relevance threshold, or all candidates were excluded — and exits 3, matching `lint` and `check`. The dry run reports the same, and both now count against the number of specs actually resolved rather than the post-threshold candidates.

## 0.4.0-alpha.12

### Minor Changes

- b16e0e0: feat(diff): add `--working` and stop reporting a false all-clear on uncommitted specs

  `diff` compares committed refs, so uncommitted spec edits were invisible — and reported as "✓ No spec changes detected". `specdx-pre-commit` turned that into "safe to commit" at the one moment the check exists to prevent drift.

  Two changes:
  - `diff` now lists spec files changed in the working tree that the compared refs do not cover, so the green is never unqualified. Exit code is unchanged.
  - New `--working` flag (and `working` on the MCP `sdx_diff` tool) compares the base ref against the working tree, including staged, unstaged, and untracked spec files.

  The `specdx-pre-commit` and `specdx-check-drift` skills now use `--working`.

### Patch Changes

- 51aa872: fix(diff): resolve spec entries declared by a glob path

  `diff` matched changed files against config `path` values by string equality, so a glob entry (`specs/stories/*.md`) matched nothing and every spec behind it was invisible — reported as "no spec changes detected" and omitted from downstream impact. Paths are now matched as patterns, and globs expand against the compared ref rather than the working tree. Spec ids for added and removed files come from their frontmatter instead of the config entry key. Affects CLI `diff`, CLI `changelog`, the MCP `diff` tool, and the GitHub Action.

## 0.4.0-alpha.11

### Patch Changes

- 0a78530: Declared `exports` now follow the same spec-status rule as declared file paths (#19). The #17 fix gated only file existence, so a `draft` spec that planned a new export on an already-existing file still failed with an error and exit 1 — the same friction #17 removed, reached by a different path, and it made the workaround worse because the `artifacts:` block could be only half-declared. A missing export is now `pending` (info, excluded from the score, exit 0) while the spec is `draft`, `review`, or `superseded`, and an enforced error once it is `approved`, with suggestion wording that reads as a plan rather than a defect. Exports that already exist are verified regardless of status.

## 0.4.0-alpha.10

### Patch Changes

- 72d0d82: Reconcile config `requires` and frontmatter `references` (ADR: references/requires unification, Option B). The two declaration styles now give the same answer to "what is upstream/downstream of this spec?", which fixes two silent failures:
  - `freshness/staleness-check` read only frontmatter references, so a suite declaring dependencies through config `requires` alone got **no** relative-staleness warnings. It now reads both.
  - Downstream impact analysis ran a graph walk keyed by config entry name using a spec id, so `diff` reported no downstream impact whenever entry keys differed from spec ids — which is most suites. Impact now works in spec id space.

  The dependency-implying relationship taxonomy moved from a constant in `@specdx/core` into `@specdx/schema` as `SPEC_RELATIONSHIPS` and `DEPENDENCY_RELATIONSHIPS`, drift-tested against `base-spec.json` the same way spec types already are, so a relationship kind can no longer be added without declaring its dependency semantics. A new `buildRelationResolver` export unions both sources and tags each edge `requires`, `references`, or `both`.

  One behaviour change to expect: `implemented-by` is now read in the documented direction throughout ("A is implemented-by B" means B depends on A); the staleness rule previously inverted it. Suites that declare dependencies only in config `requires` may see staleness warnings they have not seen before — that is the fix working.

  No change to `spec.config.yaml` or the frontmatter schema.

## 0.4.0-alpha.9

### Patch Changes

- 77484e0: Declared artifacts are enforced by spec status, so spec-first authoring no longer breaks the check gate (#17). A spec that is `draft`, `review`, or `superseded` reports declared-but-absent files as **pending** — an info finding, excluded from the score, exit 0 — because a spec written before its implementation is a plan, not a defect. Once the spec is `approved` the same absence is a missing-artifact error that exits 1, which gives `check` a signal it could not express before: "this spec is approved but its artifacts do not exist" is drift, and is different from "this spec is a draft and nothing is built yet". Artifacts that do exist are verified regardless of status. Pending counts appear in the verbose scan summary and in the notes.
- 7374dbd: Close out the vacuous-pass bug class (follow-up to #6, #10, #12): a suite whose spec paths resolve to no files no longer reports success from any command.
  - `validate` now resolves every declared spec path: a `required` entry matching no files is invalid, an optional entry matching nothing warns, and an entirely empty suite warns that downstream checks would pass vacuously. Output distinguishes spec _entries_ from resolved spec _files_.
  - `lint` reports "no specs found — nothing was linted" and exits 3 (matching `check`'s not-assessed convention) instead of "✓ All specs pass lint checks".
  - `status` gains an `unassessed` verdict for an empty suite instead of reporting "healthy" (CLI and MCP).
  - `ready` gains a "Spec suite non-empty" check, and its lint-health and staleness checks now report as skipped rather than ticking over an empty set.
  - The GitHub Action PR comment no longer renders a green check for "0 specs checked", so a misconfigured glob cannot show green in CI.

## 0.4.0-alpha.8

### Minor Changes

- bd51b19: Framework-agnostic checkable artifacts (#15): any spec can now declare the implementation artifacts it requires in an optional `artifacts:` frontmatter field — file paths that must exist and names they must export. `specdx check` verifies them as a new `artifact` finding category, counts them toward the implementation score, and reports them in the scan summary, so projects without a supported framework (Astro, static sites, CLIs, libraries) get real drift checking instead of "coverage not assessed". Export checks use ts-morph and are skipped with a note — never silently passed — when unavailable. Also fixes single-file `lint <path>`, which previously false-errored on cross-references because it hid the rest of the suite from the reference rule; it now lints against the full suite and reports only the target file's diagnostics.

## 0.4.0-alpha.7

### Patch Changes

- 7f14d95: Fix two issues from umar.codes dogfooding round 3:
  - `pack` no longer silently truncates trimmed specs: omission markers are now guaranteed — their token cost is reserved before sections are kept, so a trimmed spec can never read as complete. Each cut gets one marker naming the omitted sections (e.g. `[2 sections omitted to fit token budget: Data Model, API Design]`), and a new `Sections omitted` counter surfaces in dry-run output, the token report, and the XML/JSON formats (#12)
  - `decomposed-into` is no longer treated as dependency-implying, so `graph` stops suggesting inverted `requires` edges for parent→child decomposition; suggestions are now cycle-checked before printing (cycle-creating ones become an explicit conflict warning instead), and `validate` now builds the dependency graph, failing on circular or dangling `requires` chains instead of accepting them (#13)

## 0.4.0-alpha.6

### Minor Changes

- 3daa5b5: Fix six issues found dogfooding specdx on a real project (umar.codes):
  - `--version` now reports the actual published version instead of 0.0.0 (#5)
  - `check` reports "coverage not assessed" with a distinct exit code 3 when nothing is checkable, instead of a vacuous 100% pass; `--verbose` lists what was scanned (#6)
  - `check` degrades gracefully when ts-morph is unavailable (e.g. under `pnpm dlx`): route/type extraction is skipped with an actionable note instead of a raw stack trace (#7)
  - `graph` now surfaces frontmatter `references` as labeled edges (dashed in dot output) and warns when a dependency-implying reference is not reflected in config `requires` (#8)
  - `pack` relevance: a task that names a spec's id verbatim always ranks it at 1.0, and high-relevance specs are trimmed into the remaining budget (with omission markers) instead of silently excluded (#9)
  - `ready` reports vacuous checks as "skipped" (e.g. story coverage with no PRD) rather than showing them as passes (#10)

## 0.4.0-alpha.5

### Patch Changes

- 7591c43: `generate story` now truncates long filenames on a word boundary instead of cutting mid-word (`...-rules-across.md` rather than `...-rules-across-st.md`).

## 0.4.0-alpha.4

### Minor Changes

- d246c79: Focus specdx on its core identity: the context engine for spec-driven development.
  - `check`, `check --ai`, `update --from-code`, `generate test-plan`, and `migrate` are now flagged `[experimental]` in CLI help — they remain fully functional but are not part of the stable surface
  - README rewritten around the core loop: validate → lint → pack → keep fresh
  - `status`, `ready`, `explain`, `diff`, and `changelog` now print a friendly error instead of a stack trace when no `spec.config.yaml` exists
  - MCP server: per-tool test coverage for all 7 tools and corrected server version

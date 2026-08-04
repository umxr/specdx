# specdx

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

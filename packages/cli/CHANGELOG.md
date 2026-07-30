# specdx

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

---
"specdx": minor
---

fix: repair every defect found by the fifth audit run

Audit run 5 confirmed all five run-4 fixes hold on every surface. It found one blocker and eight lesser defects, all fixed here.

**F1 (blocker) — the GitHub Action passed green when it checked zero specs.** The job's verdict read only the diagnostics array, so a config whose spec paths resolved to no files produced no diagnostics and a successful job that enforced nothing. Every CLI command already guarded this; the one surface that gates CI did not. This is the vacuous-pass class re-opening: the 2026-07-30 pass fixed the Action's PR-comment renderer and declared the class closed, and the comment renderer turned out to be unreachable code.

**F2 (medium) — `--format`, `--quiet` and `--verbose` were advertised on every command and honoured by few.** One blanket `sharedArgs` object gave nine commands a `--format` help text listing `github` while two implemented it; `validate` and `graph` ignored `--format` entirely; an unknown value fell through to pretty output with exit 0; and `--quiet` only lowered a log level while every line went out through `console.log`. Commands now declare the formats they render, an unsupported value is an error naming the supported set, `validate` and `graph` gained real JSON, `check` gained GitHub annotations, `graph --format dot` is documented, and `--quiet` suppresses success and summary output while problems still print.

**F3 (medium) — the published `index.d.ts` exported five functions and none of their types.** `import type { PackResult } from "specdx"` failed with TS2459, so a consumer could call the API and then not annotate what it returned.

**F4 (medium) — the `specCount` → `specFiles` rename had landed on MCP only.** CLI `status` reported `specCount` meaning spec files while `runValidate` used the same name for config entries. Renamed to `specFiles` and `specEntries` across the CLI and the library, matching MCP.

**F5–F8 (low).** Info diagnostics render as `::notice` rather than `::warning`, so an advisory no longer reports as a warning on a clean suite. `check --verbose` says artifacts were "assessed" rather than "verified", which contradicted the failure printed two lines below. `check --ai` without a key prints a formatted error instead of an uncaught stack trace. `runStatus` and `runDiff` accept a `configDir` like `runLint` and `runPack`.

**F9 — `completeness/edge-case-coverage` could never fire on a test plan.** It substring-matched "edge case" over the whole document while the type requires an `## Edge Cases` heading, so the required scaffolding satisfied the rule. It now judges the section's content. User-story behaviour is unchanged.

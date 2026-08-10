---
"specdx": patch
---

fix: repair both defects found by the sixth audit run

Audit run 6 verified all ten run-5 findings fixed with no regressions, and
surfaced two further defects in `status`. Both predate the run-5 fixes — they
reproduce identically against `0.4.0-alpha.21` — and both are fixed here
because the second changes the meaning of a published field, which is free now
and breaking after `0.4.0`.

- **G1: `status --format github` could emit nothing at all.** The formatter
  rendered stale specs and integrity issues and nothing else, so a suite whose
  only problem was lint errors produced zero bytes and exited 0 while the same
  run's JSON reported `verdict: "errors"`. A workflow step using the documented
  format showed a silent green. It now always prints a headline annotation
  carrying the project, the verdict and the counts, at the level the verdict
  reports — `::error` for `errors`, `::notice` for `healthy`, `::warning`
  otherwise — so the github and pretty renderers of one command cannot disagree.
  An `unassessed` run additionally says that nothing was assessed. Lint
  diagnostics are deliberately not re-annotated here: `lint --format github`
  owns those, and a workflow running both should not receive each twice.

- **G2: `lintHealth.passing` subtracted a diagnostic count from a spec count.**
  `passing: specs.length - errors` reported `-6` for one spec carrying seven
  error-severity diagnostics. It now counts the specs that emitted no
  error-severity diagnostic. The mismatch survived six audits because every
  fixture exercising `status` is error-free, where `specs.length - 0` happens
  to be the right answer.

  **Fixed in two places, because there are two.** `sdx_status` duplicates the
  CLI's `runStatus` rather than calling it — the dependency runs cli → mcp, so
  it cannot be the other way round — and the first attempt at this fix repaired
  only the CLI. Re-verifying the published alpha found MCP still returning
  `-6`; a unit test on either side alone passed throughout. The duplication
  stands, but no longer silently: a new parity test in the CLI package holds
  the two implementations to the same `specFiles`, `verdict` and `lintHealth`
  on a fixture with more errors than specs, and asserts the value absolutely as
  well as relatively, since two implementations agreeing on a wrong number is
  not parity.

Both carry regression tests that fail against the code they replace: a
process-level pair in `cli-behaviour.test.ts` asserting `status --format github`
is never zero bytes and annotates at its own verdict's level, and unit tests in
`status.test.ts` covering a suite with more errors than specs and a suite whose
only diagnostics are warnings.

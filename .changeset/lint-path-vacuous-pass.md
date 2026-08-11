---
"specdx": patch
---

Fix `specdx lint <path>` reporting a clean pass when the path matched no spec

`specdx lint specs/typo.md` printed "✓ All specs pass lint checks" and exited
`0`. In `--format json` it printed `[]`; in `--format github` it printed
nothing at all. All three exited `0`. A mistyped or renamed path was
indistinguishable from a healthy suite, so a CI job linting only the files a
pull request touched would go green forever once a spec was renamed.

The vacuous-pass guard added in 0.4.0 for `lint.ignore` computed its count over
the whole suite, and the path argument filtered *diagnostics* rather than the
count — so narrowing to zero specs still reported the suite as assessed. Both
now share one predicate, so the count and the filter cannot disagree again.

A path matching no spec now exits `3` and says which path missed. Exit `3`
already meant "nothing was assessed" for an empty suite; it now covers this
case too, and is documented in `docs/ci.md` with the rest of the lint exit
codes. Linting a path that does match is unchanged.

The same defect was present in the MCP `sdx_lint` tool, which reports a new
`assessed` field alongside `specsChecked`. `sdx_lint` also filtered the spec
list *before* linting, so a single-file lint could not see the rest of the
suite and cross-reference rules produced false positives against specs that
exist. It now lints the full suite and filters the diagnostics, matching the
CLI. A parity test holds the two implementations to each other.

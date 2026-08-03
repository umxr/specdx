---
"specdx": patch
---

Close out the vacuous-pass bug class (follow-up to #6, #10, #12): a suite whose spec paths resolve to no files no longer reports success from any command.

- `validate` now resolves every declared spec path: a `required` entry matching no files is invalid, an optional entry matching nothing warns, and an entirely empty suite warns that downstream checks would pass vacuously. Output distinguishes spec *entries* from resolved spec *files*.
- `lint` reports "no specs found — nothing was linted" and exits 3 (matching `check`'s not-assessed convention) instead of "✓ All specs pass lint checks".
- `status` gains an `unassessed` verdict for an empty suite instead of reporting "healthy" (CLI and MCP).
- `ready` gains a "Spec suite non-empty" check, and its lint-health and staleness checks now report as skipped rather than ticking over an empty set.
- The GitHub Action PR comment no longer renders a green check for "0 specs checked", so a misconfigured glob cannot show green in CI.

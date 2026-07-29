---
"specdx": minor
---

Fix six issues found dogfooding specdx on a real project (umar.codes):

- `--version` now reports the actual published version instead of 0.0.0 (#5)
- `check` reports "coverage not assessed" with a distinct exit code 3 when nothing is checkable, instead of a vacuous 100% pass; `--verbose` lists what was scanned (#6)
- `check` degrades gracefully when ts-morph is unavailable (e.g. under `pnpm dlx`): route/type extraction is skipped with an actionable note instead of a raw stack trace (#7)
- `graph` now surfaces frontmatter `references` as labeled edges (dashed in dot output) and warns when a dependency-implying reference is not reflected in config `requires` (#8)
- `pack` relevance: a task that names a spec's id verbatim always ranks it at 1.0, and high-relevance specs are trimmed into the remaining budget (with omission markers) instead of silently excluded (#9)
- `ready` reports vacuous checks as "skipped" (e.g. story coverage with no PRD) rather than showing them as passes (#10)

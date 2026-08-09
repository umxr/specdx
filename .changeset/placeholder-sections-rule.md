---
"specdx": minor
---

feat(lint): flag placeholder sections, and stop declaring a scaffold READY

`specdx init` produced specs whose every section was `<!-- placeholder -->`, and `lint`, `status` and `ready` all passed them — `structure/required-sections` checks that a heading exists, never that anything was written under it.

New rule `completeness/no-placeholder-sections` (severity `warn`) flags sections whose body is empty or only a placeholder marker, matched against the whole body so prose mentioning a TODO is untouched. `ready` gains a "Specs have content" check that fails on them, since `ready` gates on errors and a warning alone would not block the verdict.

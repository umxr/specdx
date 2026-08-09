---
"specdx": patch
---

fix(pack): report when nothing was packed instead of emitting an empty context

`pack` wrote an empty `<context>` to stdout and exited 0 when no spec was selected, which reads as a successful pack to whatever consumes it. It now explains why — config resolved nothing, everything scored below the relevance threshold, or all candidates were excluded — and exits 3, matching `lint` and `check`. The dry run reports the same, and both now count against the number of specs actually resolved rather than the post-threshold candidates.

---
"specdx": patch
---

Fix two issues from umar.codes dogfooding round 3:

- `pack` no longer silently truncates trimmed specs: omission markers are now guaranteed — their token cost is reserved before sections are kept, so a trimmed spec can never read as complete. Each cut gets one marker naming the omitted sections (e.g. `[2 sections omitted to fit token budget: Data Model, API Design]`), and a new `Sections omitted` counter surfaces in dry-run output, the token report, and the XML/JSON formats (#12)
- `decomposed-into` is no longer treated as dependency-implying, so `graph` stops suggesting inverted `requires` edges for parent→child decomposition; suggestions are now cycle-checked before printing (cycle-creating ones become an explicit conflict warning instead), and `validate` now builds the dependency graph, failing on circular or dangling `requires` chains instead of accepting them (#13)

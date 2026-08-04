---
"specdx": patch
---

Declared `exports` now follow the same spec-status rule as declared file paths (#19). The #17 fix gated only file existence, so a `draft` spec that planned a new export on an already-existing file still failed with an error and exit 1 — the same friction #17 removed, reached by a different path, and it made the workaround worse because the `artifacts:` block could be only half-declared. A missing export is now `pending` (info, excluded from the score, exit 0) while the spec is `draft`, `review`, or `superseded`, and an enforced error once it is `approved`, with suggestion wording that reads as a plan rather than a defect. Exports that already exist are verified regardless of status.

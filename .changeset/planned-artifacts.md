---
"specdx": patch
---

Declared artifacts are enforced by spec status, so spec-first authoring no longer breaks the check gate (#17). A spec that is `draft`, `review`, or `superseded` reports declared-but-absent files as **pending** — an info finding, excluded from the score, exit 0 — because a spec written before its implementation is a plan, not a defect. Once the spec is `approved` the same absence is a missing-artifact error that exits 1, which gives `check` a signal it could not express before: "this spec is approved but its artifacts do not exist" is drift, and is different from "this spec is a draft and nothing is built yet". Artifacts that do exist are verified regardless of status. Pending counts appear in the verbose scan summary and in the notes.

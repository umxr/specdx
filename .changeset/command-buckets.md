---
"specdx": patch
---

refactor: promote CLI commands by folder

Command modules now live in `core/` or `experimental/` buckets, and the
`[experimental]` caveat is derived from the bucket at render time rather than
typed into each description. No file under `commands/` spells the marker any
more, so the folder and the label cannot disagree.

Sub-commands carry their own bucket: `generate` is promoted, `generate
test-plan` is not, and the caveat now reaches it from its own folder instead of
a hand-written string.

Nothing changes for a user — `--help` renders the same labels — but the
conformance test now fails when a command's promotion drifts from how it
describes itself, including in the README's CLI reference. This is the drift
that quietly moved `explain` and `changelog` into the core surface.

---
"specdx": minor
---

refactor: narrow the core command surface to the focus decision

**Breaking:** the `specdx changelog` command is removed. It ran the same comparison as `diff` and differed only in presentation, so it is now a format: `specdx diff --format changelog`. `--from`/`--to` become `--base`/`--head`, and the programmatic `runChangelog` export is gone. The changelog output now also carries the uncommitted-specs warning, which matters most at release time.

`specdx explain` is flagged `[experimental]` until its output earns a core slot.

This takes the core surface from 13 commands to 11, so every core command traces back to the context-engine focus decision rather than to drift.

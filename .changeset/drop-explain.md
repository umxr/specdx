---
"specdx": minor
---

refactor: drop the `explain` command

**Breaking:** `specdx explain` is removed, along with the programmatic `runExplain` export.

It summarised each spec by its first non-empty line, which on a freshly scaffolded suite is the template's `<!-- placeholder -->` comment — so the one command meant to orient a new developer described every spec as a placeholder. Everything it reported is already available and correct elsewhere: `status --format json` for the project name, counts, statuses and health, `graph` for how specs relate, and `pack --full` for the content itself. The `specdx-onboard` skill now drives that sequence.

0.x is the last cheap moment to remove a command; after a stable release it breaks users.

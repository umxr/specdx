---
"specdx": minor
---

Make `check` adoptable: a baseline, and a first run that does not lie

`specdx check` could not be turned on in a repo that already exists. It reported
every pre-existing finding at once, so the CI step got deleted the same day it
was added. It also failed maximally on stacks it could not read, and reported
"I could not look" as "I found nothing wrong". Four changes, all aimed at a gate
a team would keep switched on.

**A baseline, so the gate ratchets.**

```bash
specdx check --update-baseline   # record what is accepted today
specdx check --baseline          # gate only on what is new
```

The baseline narrows what *gates*, never what is *scored*. Coverage is computed
over every finding, baselined or not — a baseline that moved the number would
report an existing project as complete on the day it was adopted, which is issue
#6's vacuous 100% wearing a different hat. Entries are stored as fields rather
than a joined key, because the file is committed and whoever approves the diff
has to be able to read what is being accepted:

```json
{ "type": "missing", "category": "route", "specId": "api-001",
  "expected": "POST /invoices", "count": 1 }
```

Fingerprints exclude line numbers, because a baseline invalidated by an added
import is a baseline nobody keeps. They include `actual`, because an `extra`
finding's `expected` is the literal string "(not in spec)" and without `actual`
every extra finding in a spec would share one key and suppress its neighbours.
Counts are recorded so a second occurrence of the same drift cannot hide behind
the first. An unreadable baseline is refused loudly: degrading to "no entries"
would gate everything at once, and degrading to "suppress everything" would hide
real drift.

**An unrecognised stack is skipped, not failed.**

Route extraction falls back to running all three extractors and merging. On
NestJS, tRPC, or anything not JS, all three read nothing, so every spec'd
endpoint became a `missing` finding at severity error — a first run that looked
like total drift on a project that might be complete, for most of the market.
When no framework is detected *and* the fallback read nothing, routes are now
skipped with a note, the pattern the ts-morph path already used. An explicit
`--framework` or `check.framework` still assesses, because there the user has
asserted the stack.

**A declared surface that could not be read exits 4.**

Notes had no exit-code consequence, so "no fields recognised in its Data Model"
was green *and* raised the percentage, because unparsed content leaves the
denominator. `CheckResult` now carries `unassessed`, the subset of notes naming
a surface the author declared that could not be read, and `check` exits 4 for
it. `--allow-unassessed` accepts it deliberately.

Exit codes are now `0` ok, `1` errors, `3` nothing checkable, `4` a declared
surface could not be read — and the code is decided once, before anything is
printed, so the report cannot name an exit the process does not use.

**Test cases are reported but no longer scored.**

They are matched by Jaccard similarity over prose at a 0.4 threshold. Measured
against the real function:

```
0.167  "rejects a request with an expired token"
       vs `returns 401 when the token has expired`        -> MISSING
0.750  "creates an invoice"  vs `creates an invoice draft` -> COVERED
```

Both correct implementations are called missing; both wrong ones pass. It
rewards shared vocabulary rather than shared meaning, and it is worst exactly
when the test plan is written before the tests by someone other than their
author — the workflow specdx advocates. Findings still surface at `warn`, where
a human can judge them, and the category is labelled "advisory, not scored" so
the arithmetic above it stays explicable.

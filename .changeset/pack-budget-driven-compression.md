---
"specdx": patch
---

fix(pack): stop collapsing stale specs when the budget has room for them

`pack` compressed every spec untouched for `stable_days` (7 by default) before
it ever consulted the budget, so a suite that fitted comfortably still came back
as `[Unchanged since … — N tokens omitted]` stubs. On specdx's own specs that
meant 1,457 of 12,000 tokens used and 20 sections stubbed, when the whole suite
fits in 8,056. Specs that have not changed in a week are the normal case, so the
default configuration degraded almost every real suite — silently, since
`used=1457 budget=12000 omitted=0` reads like a healthy pack.

The staleness collapse is now a response to budget pressure: full content is
used when it fits, and stale specs collapse from least relevant upward only
until the suite fits. Boilerplate stripping and superseded-ADR collapse are
unchanged — those are hygiene at any budget.

Fixes #33.

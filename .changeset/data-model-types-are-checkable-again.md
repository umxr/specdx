---
"specdx": minor
---

`check` reads Data Models people actually write, and defers a draft's types

Three defects, one section. Between them, the type half of `specdx check` was
inert on real suites while reporting full coverage from artifacts alone.

**A description after a field's type no longer drops the field** (#51). The
house style for endpoints has always been `- GET /path — description`, and the
same em-dash after a field's type made it unreadable, so a Data Model written
in exactly the form the warning asked for was rejected by it:

```markdown
### TagEntry

- tag: string — the raw frontmatter token, kebab-case, also the URL segment
- posts: Post[] — published posts carrying the tag, newest first
```

` — `, ` – `, ` - ` and a trailing parenthetical are now all read as
descriptions, and only outside brackets and quotes, so a hyphen inside the type
still belongs to the type. The type itself may be any ordinary TypeScript
annotation: `"light" | "dark"`, `Record<string, number>`, `Map<string,
Set<number>>`, `{ id: string }`, `() => void`. The previous shape allowed a
bare identifier and its `.<>[]` suffixes, so a string-literal union and a
two-parameter generic were both read as prose. A sentence is still a sentence —
`- Note: this table is partitioned by tenant` is not a field.

**A prose Data Model is no longer a permanent warning** (#38). Prose declares
no fields and is not trying to; warning once per spec on every run, with no
edit short of restructuring valid prose to clear it, taught people to ignore
every warning `check` prints. What replaced it is narrower and actionable: a
field line that no `### TypeName` heading claims is named, because that is a
declaration expecting to be checked with nothing checking it.

**A draft spec's types are planned, not missing** (#52). `status` deferred
declared artifacts and not Data Model types, so one spec's four planned files
were held back with a clear message while its two planned types were hard
errors and coverage fell. Types now follow the same table as artifacts:

| Spec status | Missing file, export or type | Exit code |
|---|---|---|
| `draft`, `review`, `superseded` | **pending** — planned, not built. Excluded from the score. | 0 |
| `approved` | **missing** error | 1 |

A type that *does* exist is still checked field by field whatever the status —
the artifacts rule, unchanged: only absence is deferred. Both surfaces now read
the rule and the wording from one place, so they cannot drift into two policies
for one question again.

`--verbose` reports pending types beside pending artifacts, and `check --format
json` carries `scanned.typesPending`.

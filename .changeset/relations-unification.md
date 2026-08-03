---
"specdx": patch
---

Reconcile config `requires` and frontmatter `references` (ADR: references/requires unification, Option B). The two declaration styles now give the same answer to "what is upstream/downstream of this spec?", which fixes two silent failures:

- `freshness/staleness-check` read only frontmatter references, so a suite declaring dependencies through config `requires` alone got **no** relative-staleness warnings. It now reads both.
- Downstream impact analysis ran a graph walk keyed by config entry name using a spec id, so `diff` reported no downstream impact whenever entry keys differed from spec ids — which is most suites. Impact now works in spec id space.

The dependency-implying relationship taxonomy moved from a constant in `@specdx/core` into `@specdx/schema` as `SPEC_RELATIONSHIPS` and `DEPENDENCY_RELATIONSHIPS`, drift-tested against `base-spec.json` the same way spec types already are, so a relationship kind can no longer be added without declaring its dependency semantics. A new `buildRelationResolver` export unions both sources and tags each edge `requires`, `references`, or `both`.

One behaviour change to expect: `implemented-by` is now read in the documented direction throughout ("A is implemented-by B" means B depends on A); the staleness rule previously inverted it. Suites that declare dependencies only in config `requires` may see staleness warnings they have not seen before — that is the fix working.

No change to `spec.config.yaml` or the frontmatter schema.

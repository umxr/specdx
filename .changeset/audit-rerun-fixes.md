---
"specdx": patch
---

Repair every defect found by the audit re-run against the published alpha.18.

**`check` now reads a bulleted Endpoints section.** `parseEndpoints` accepted
only `### METHOD /path` headings, so an api-contract written as a list parsed to
zero endpoints: routes left the coverage denominator, every implemented route
was reported as unspecified, and a genuinely absent endpoint was never
mentioned — while the score *rose*, because understanding less removed the
category. A populated section that still yields nothing now produces a note, the
way an unreadable Data Model already did. Both micro-formats are documented in
the README and the author-spec skill for the first time.

**The plugin's SessionStart hook runs the CLI it ships with.** It resolved
`specdx` from `PATH` (else `npx --yes specdx`), so a stale global install
answered and its "config invalid" was injected into the session as fact. It now
prefers `${CLAUDE_PLUGIN_ROOT}/dist/main.js`, then the project's own
devDependency, and caps the graph it injects rather than growing with the suite.

**`generate test-plan` no longer destroys hand-written specs.** It overwrote an
approved, registered test plan with a draft stub, silently, with exit 0. It now
refuses unless given `--force`, and only suggests a config key when the file is
not already registered.

**`generate story` and the lint rule agree about what a feature is.** The
generator kept its own regex requiring `**F<N>**:`, so the same PRD produced
three features in `lint` and `ready` and none in the generator. Both now call
`parseFeatureEntries`.

Also fixed:

- A `###` sub-heading inside a Data Model no longer becomes a phantom type: a
  block earns its place by declaring at least one field and naming a single
  identifier, so `### Notes on the model` is prose again rather than a type
  called `Notes` that `check` demanded code implement.
- The published package ships `dist/index.d.ts`, with the bundled `@specdx/*`
  types inlined so no declaration imports a package that was never published.
- Every package lists `types` first in its `exports` map — after `import`, the
  condition was never reached, so declarations could be present and still not
  be found.
- New `structure/id-matches-config-key` rule: a spec whose frontmatter `id`
  differs from its config key is named directly, instead of surfacing as
  dangling-reference errors against the specs that referenced it.
- `completeness/edge-case-coverage` recognises any 4xx/5xx status code and
  words like "conflict" and "denied". It knew only `404` and `500`, so a story
  whose error path was a 409 read as having no error handling at all.
- The MCP server reports the real package version instead of a hardcoded
  `0.4.0`, and `sdx_status` drops the ambiguous `specCount` alongside
  `specFiles`.
- Shipped skills name the `specdx` binary, not the `sdx` one that does not
  exist.
- Nested sub-command help no longer repeats its parent (`generate generate
  story`).
- `migrate` reports a config `version` it does not support instead of printing
  it and declaring no migration needed.
- `specdx init` defaults the project name to the target directory, so the first
  command a new user runs no longer fails on a missing flag.

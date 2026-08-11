---
"specdx": minor
---

Lint AGENTS.md and CLAUDE.md with no spec suite

`specdx lint` in a project with no `spec.config.yaml` now lints its `AGENTS.md`
and `CLAUDE.md` instead of erroring. This is the on-ramp 0.5.0 promised and did
not deliver: agent linting existed but was reachable only from inside a spec
suite, so the users it was built for — anyone with a CLAUDE.md and no specs —
could not run it at all.

```bash
cd any-project-with-a-claude-md
npx specdx lint
```

A clean agent-only run says what it did and did not check:

```
✓ 1 agent file checked, no problems found.
  No spec.config.yaml here, so no specs were checked. Run `specdx init` to add a spec suite.
```

Four things it deliberately does not do:

- **A missing config degrades; an unusable one does not.** A malformed config,
  a schema-invalid one, one that cannot be read, and one that is not a regular
  file are all errors. Only genuine absence takes this path — `findConfig` is
  now exported from `@specdx/core` so the two can be told apart before loading,
  and it distinguishes `ENOENT`/`ENOTDIR` from every other errno rather than
  reporting them all as "not there". A root-owned checkout read by a non-root
  CI job is present-but-unreadable, and silently linting a narrower set there
  would be reported as a pass.
- **Neither a config nor an agent file is still an error**, with the same
  "Run 'specdx init'" guidance as before. The on-ramp must not turn "you are in
  the wrong directory" into a pass.
- **`specdx lint <path>` is an error here, not a fallback.** You named a spec
  file; linting `CLAUDE.md` instead and exiting 0 would report a pass for a file
  nothing opened. Same on `sdx_lint({ specPath })`.
- **`assessed` keeps meaning "specs were assessed"**, so the vacuous-pass guard
  it exists for is unweakened. A new `specSuite` flag is what tells a caller
  that `specFiles: 0` is expected here rather than a suite that resolved to
  nothing.

Agent-only mode is visible in **every** output format, not just the clean
pretty message: `json` and `github` carry an `agents/no-spec-suite` info
diagnostic. A CI job running `--format json` in a tree whose `spec.config.yaml`
was never checked out would otherwise read `[]` and exit 0 — byte-identical to
a clean suite, with the suite never opened. Info severity, so a supported
outcome cannot fail a build.

Behaviour inside a project that *has* a `spec.config.yaml` is unchanged: the
`agents` key is still what turns agent linting on there.

`sdx_lint` over MCP behaves identically and reports `specSuite`. Both surfaces
call one shared `lintAgentFilesWithoutConfig` in `@specdx/lint` rather than
each implementing the degrade — the cli/mcp duplication has shipped a
divergence three times, and this is a case where the shared code can sit below
both instead of being pinned by a test after the fact.

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

Three things it deliberately does not do:

- **A missing config degrades; a broken one does not.** Both surface as
  `ConfigError`, and treating a malformed config as "no config" would turn a
  YAML typo into a narrower check reported as a pass. Only genuine absence
  takes this path — `findConfig` is now exported from `@specdx/core` so the two
  can be told apart before loading.
- **Neither a config nor an agent file is still an error**, with the same
  "Run 'specdx init'" guidance as before. The on-ramp must not turn "you are in
  the wrong directory" into a pass.
- **`assessed` keeps meaning "specs were assessed"**, so the vacuous-pass guard
  it exists for is unweakened. A new `specSuite` flag is what tells a caller
  that `specFiles: 0` is expected here rather than a suite that resolved to
  nothing.

Behaviour inside a project that *has* a `spec.config.yaml` is unchanged: the
`agents` key is still what turns agent linting on there.

`sdx_lint` over MCP behaves identically and reports `specSuite`. Both surfaces
call one shared `lintAgentFilesWithoutConfig` in `@specdx/lint` rather than
each implementing the degrade — the cli/mcp duplication has shipped a
divergence three times, and this is a case where the shared code can sit below
both instead of being pinned by a test after the fact.

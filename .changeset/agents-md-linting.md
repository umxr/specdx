---
"specdx": minor
---

Lint AGENTS.md and CLAUDE.md

specdx now validates the agent instruction files you already have, not only the
specs it defines. Opt in with a new `agents` key:

```yaml
agents:
  paths: ["AGENTS.md", "CLAUDE.md"]
  max_tokens: 8000
  rules:
    agents/stale-references: "error"
```

Three rules, in their own `agents/` namespace:

- **`agents/structure`** — the file has content, and is organised under headings
  rather than being one undifferentiated block.
- **`agents/stale-references`** — every path the file names still exists. This
  is the one that earns its keep: a CLAUDE.md pointing at a file that moved
  sends every agent session to the wrong place, confidently.
- **`agents/size-budget`** — the file fits a token budget, counted with the same
  tokenizer `pack` uses, so the numbers agree.

These files are **not specs**. They carry no frontmatter, are absent from the
`specs` map, and never enter the dependency graph — `pack`, `diff`, `status` and
`check` are unchanged and cannot see them. specdx reads them and never rewrites
them.

The `agents` key is what turns this on, so upgrading adds no diagnostics to a
suite that did not ask for them. The rules are not part of the `minimal`,
`recommended` or `strict` presets either: `lint.extends: strict` will not
promote a finding about your CLAUDE.md into a build failure. Only `agents.rules`
sets their severity, and an unknown rule id there is an error — including when
switching one `off`, since a typo that silently configures nothing is how
`lint.rules` stayed inert through six audits.

Reference extraction is deliberately conservative, because a false positive
teaches people to switch a rule off. Only inline code spans that look like paths
and relative Markdown link targets count; fenced code blocks are skipped
entirely. References resolve by **suffix** against the real file tree, so the
shorthand these files actually use keeps working — `` `resolver.ts` `` resolves
against `packages/pack/src/resolver.ts`. Common placeholder stems (`foo`, `bar`,
`example`) are never reported. A file naming no paths reports an `info` notice
saying nothing was checked, rather than passing silently.

`agents.paths` matching no file is an error, not a quiet pass.

A clean `specdx lint` now says what it checked — `✓ 18 specs and 1 agent file
checked, no problems found.` — because "All specs pass lint checks" was silent
about whether the agent files were looked at, and a run that skipped them read
identically to one that checked them.

`sdx_lint` over MCP gains the same behaviour and reports `agentFilesChecked`.

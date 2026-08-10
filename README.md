# specdx

> Keep AI coding sessions grounded in specs your team actually maintains.

[![npm version](https://img.shields.io/npm/v/specdx)](https://www.npmjs.com/package/specdx)
[![license](https://img.shields.io/npm/l/specdx)](LICENSE)
[![CI](https://github.com/umxr/specdx/actions/workflows/ci.yml/badge.svg)](https://github.com/umxr/specdx/actions/workflows/ci.yml)

specdx gives your PRDs, technical designs, user stories and API contracts a
schema, lints them for the gaps an LLM will trip over, and packs the relevant
ones into a token budget before you start coding. No LLM calls in the pipeline,
no API key, deterministic enough to gate a pull request on.

```bash
npm install -D specdx
```

## Quick start

```bash
npx specdx init --template lightweight   # scaffold specs/ and spec.config.yaml
npx specdx lint                          # find the gaps
```

`init` writes specs with placeholder sections, and `lint` tells you which ones
still need filling in. Once they have real content, pack it for a task:

```bash
npx specdx pack --task "add rate limiting" --copy
```

This scores every spec for relevance to the task, fits the best of them into a
token budget, strips boilerplate, and puts the result on your clipboard. Paste
it into your LLM session — or let the Claude Code plugin run it for you.

It exits 3 and packs nothing if no spec is relevant yet, rather than handing you
an empty context that looks like an answer.

## Why

An LLM writing code against your project is only as good as the context it was
given. In practice that context is pasted by hand, half-remembered, and stale.

specdx makes it a build artifact:

- **Specs are validated, not vibes.** Required sections per type, cross-references
  that must resolve, dependency cycles caught. Thirteen rules, three presets.
- **Context is budgeted, not dumped.** `pack` picks what is relevant to the task
  at hand and fits it to a token limit, instead of pasting the whole folder.
- **Drift is visible.** Change the PRD and `diff` tells you which downstream
  specs the change reached, before the gap compounds.

## The loop

```bash
specdx pack --task "what you're about to build" --copy   # before you code
specdx lint                                              # before you commit
specdx diff                                              # what changed, and what it affects
specdx ready                                             # is this fit to build from?
```

`ready` is the gate between planning and building: required specs present, lint
clean, references resolving, nothing stale, and every PRD feature carrying a
user story.

## Configuration

`spec.config.yaml` at the project root. Only `version` and `specs` are required.

```yaml
version: "1.0"
project:
  name: "my-project"

specs:
  prd:
    path: specs/prd.md
    type: prd
    required: true
  technical:
    path: specs/technical-design.md
    type: technical-design
    requires: ["prd"]
  stories:
    path: "specs/stories/*.md"
    type: user-story
    requires: ["prd"]

lint:
  extends: "recommended"        # minimal | recommended | strict
```

`requires` is what builds the dependency graph, and the graph is what makes
`diff` able to tell you that changing the PRD stales the test plan.

**→ [Full configuration reference](docs/configuration.md)** — lint rule
overrides, custom rules, pack budgets, staleness thresholds, `check` paths.

## Spec format

Markdown with YAML frontmatter. Nine types, each with required sections.

```markdown
---
id: "prd-001"
type: "prd"
title: "User authentication"
status: "approved"
version: "1.0"
created: "2026-03-01"
authors: ["alice"]
---

## Problem Statement

The application has no authentication, so every endpoint is public.
```

`created` must be quoted, or YAML turns it into a date object.

**→ [Spec format reference](docs/spec-format.md)** — all nine types and their
required sections, cross-references, declared artifacts, and the three sections
`check` parses.

## Editor and agent integration

### Claude Code

specdx ships as a plugin with **ten skills**. Install it as a dev dependency and
the plugin is discovered automatically:

```bash
npm install -D specdx
```

Or write the skill files into `.claude/skills/` yourself:

```bash
npx specdx skills install          # the eight promoted skills
npx specdx skills install --experimental   # also the two check-based ones
```

| Skill | What it does |
|-------|-------------|
| `specdx-router` | Maps every skill and when to reach for it. Start here. |
| `specdx-start-task` | Loads spec context before coding |
| `specdx-author-spec` | Guides spec writing, linting between sections |
| `specdx-plan-from-spec` | Turns specs into an implementation plan |
| `specdx-review-spec` | Multi-layer quality review of a new spec |
| `specdx-pre-commit` | Catches drift before it enters git history |
| `specdx-onboard` | Guided tour of an unfamiliar spec suite |
| `specdx-sprint-review` | Shareable spec health summary |
| `specdx-verify` | *(experimental)* Checks implementation against specs |
| `specdx-check-drift` | *(experimental)* Cross-references code changes vs specs |

### MCP

Every tool is exposed over the Model Context Protocol:

```bash
specdx mcp
```

Seven tools: `sdx_validate`, `sdx_lint`, `sdx_pack`, `sdx_status`, `sdx_check`,
`sdx_diff`, `sdx_graph`.

**→ [Cursor and Gemini CLI setup](docs/other-platforms.md)**

## CI

```yaml
permissions:
  contents: read
  pull-requests: write

steps:
  - uses: actions/checkout@v4
    with: { fetch-depth: 0 }
  - uses: umxr/specdx/packages/github-action@v0
    with:
      preset: recommended
      github-token: ${{ secrets.GITHUB_TOKEN }}
```

The action lints and diffs every pull request, posts a health comment it updates
in place, and fails the job when spec paths resolve to no files — zero specs
checked is not a pass.

Any CI can run the CLI directly instead: `specdx lint --format github` emits
inline annotations and exits non-zero on failure.

**→ [CI reference](docs/ci.md)**

## CLI

| Command | Description |
|---------|-------------|
| `specdx init` | Scaffold a spec suite (`--template lightweight\|bmad\|api-first\|quick\|context`) |
| `specdx lint` | Lint all specs (`--preset`, `--fix`) |
| `specdx validate` | Validate `spec.config.yaml` |
| `specdx pack --task <task>` | Pack specs into token-budgeted context (`--copy`, `--full`) |
| `specdx status` | Spec suite health overview |
| `specdx diff` | Spec changes and downstream impact (`--working`, `--base`, `--head`) |
| `specdx graph` | Print the dependency graph |
| `specdx ready` | Is the suite fit to implement from? |
| `specdx generate story --from <id>` | Generate story stubs from a PRD |
| `specdx skills install` | Install Claude Code skills |
| `specdx mcp` | Start the MCP server |
| `specdx check` | *(experimental)* Spec-to-implementation drift |
| `specdx update` | *(experimental)* Suggest spec updates from drift |
| `specdx generate test-plan` | *(experimental)* Test plan stub from stories |
| `specdx migrate` | *(experimental)* Migrate spec suite schema |

`--quiet` and `--verbose` are available on the reporting commands — run
`specdx <command> --help` for what each one takes.

`--format` is per command, because not every command renders every format.
Asking for one a command does not render is an error, not a silent fallback.

| Formats | Commands |
|---|---|
| `pretty`, `json`, `github` | `lint`, `status`, `check` |
| `pretty`, `json` | `validate`, `ready`, `update` |
| `pretty`, `json`, `dot` | `graph` |
| `pretty`, `json`, `changelog` | `diff` |
| `xml`, `markdown`, `json` | `pack` |

## Experimental

These ship with specdx but sit outside the stable surface — they lean on static
code analysis, which is inherently fuzzy, so their output and interfaces may
change. They are flagged `[experimental]` in `--help`.

`specdx check` extracts routes (Express, Hono, Next.js), types (TypeScript, Zod,
Prisma) and tests from your code and compares them against your specs. Where no
framework extractor applies — static sites, CLIs, libraries — a spec can declare
[artifacts](docs/spec-format.md#declared-artifacts) instead: files that must
exist and names they must export.

Accuracy feedback is what graduates these to stable.

## How it compares

**Markdown linters** (markdownlint, remark-lint) check formatting. specdx checks
semantics: required sections by spec type, cross-reference validity, dependency
cycles, downstream staleness.

**JSON Schema validators** check structure. specdx adds document-level rules
that understand how specs relate to each other — and a packer that turns the
suite into context an LLM can actually use.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, writing custom
lint rules, and the PR process.

## License

MIT — see [LICENSE](LICENSE).

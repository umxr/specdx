# Configuration

`spec.config.yaml` lives at the project root. Only `version` and `specs` are
required; everything else has a default.

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
```

Run `specdx validate` to check the file. It reports how many entries it read and
how many files those entries resolved to — a glob matching nothing is the
difference between the two.

## `specs`

A map of spec id to entry. The key should match the spec's `id` frontmatter;
`structure/id-matches-config-key` warns when they disagree, because frontmatter
references resolve against one and `requires` against the other.

| Field | Type | Meaning |
|---|---|---|
| `path` | string | File path, or a glob like `specs/stories/*.md` |
| `type` | enum | One of the nine [spec types](spec-format.md#spec-types) |
| `required` | boolean | `specdx ready` fails if this spec is missing. Default `false`. |
| `requires` | string[] | Spec ids this one depends on. Builds the dependency graph. |
| `owner` | string | Free text, surfaced in `status` for stale specs |

## `lint`

```yaml
lint:
  extends: "recommended"      # minimal | recommended | strict
  rules:
    consistency/naming-conventions: off
    completeness/story-coverage: "error"
    myorg/require-jira-ticket: ["error", { path: "./rules/require-jira-ticket.js" }]
  ignore:
    - "specs/generated/**"
```

**`extends`** picks the preset. `minimal` runs structure rules only,
`recommended` runs all thirteen, `strict` promotes every warning to an error.
Info-level advisories stay info under `strict`, since they cannot be fixed by
editing a spec.

**`rules`** overrides individual rules. Four forms:

| Form | Effect |
|---|---|
| `off` or `false` | Remove the rule |
| `"error"` \| `"warn"` \| `"info"` | Override its severity |
| `["error", { path: "./rule.js" }]` | Load a custom rule from a file |

An override beats the preset, and can re-enable a rule the preset left out —
`extends: minimal` plus `completeness/story-coverage: "warn"` runs structure
rules and that one. An unknown rule id is an error, whether you are configuring
it or turning it off, so a typo cannot look like a working config.

**`ignore`** takes globs, resolved against the config directory. Ignored specs
are still visible to cross-reference rules, so ignoring a file does not
manufacture broken references elsewhere. Ignoring every spec exits 3 with "no
specs were linted" rather than reporting a pass.

### Custom rules

A rule file default-exports an object. Both ESM and CommonJS work.

```javascript
export default {
  id: "myorg/require-jira-ticket",
  description: "PRDs must carry a Jira ticket id",
  severity: "warn",
  run(context) {
    if (context.spec.frontmatter.type !== "prd") return [];
    if (context.spec.frontmatter.jira_ticket) return [];
    return [
      {
        ruleId: "myorg/require-jira-ticket",
        severity: "warn",
        message: "PRD is missing a jira_ticket field",
        filePath: context.spec.filePath,
      },
    ];
  },
};
```

`context` carries `spec`, `allSpecs`, `config` and `graph`. The severity in
`spec.config.yaml` wins over the one the file declares, so one rule can be a
warning in one project and an error in another. Paths resolve against the
config directory, not the working directory.

Built-in rule namespaces are `structure/`, `completeness/`, `consistency/`,
`clarity/`, `freshness/` and `security/`. Use your own namespace to avoid
collisions.

## `pack`

```yaml
pack:
  max_tokens: 12000
  format: xml            # xml | markdown | json
  compression:
    strip_boilerplate: true
    stable_days: 30
    collapse_resolved_adrs: true
  boilerplate_sections: ["Open Questions"]
```

`max_tokens` is the budget `specdx pack` allocates across specs by relevance.
`stable_days` compresses specs that have not changed in that many days.

## `diff`

```yaml
diff:
  baseline_ref: main
  staleness_threshold_days: 14
  ignore_paths: ["specs/archive/**"]
```

`staleness_threshold_days` is what `status` and `ready` use to call a spec
stale.

## `check`

```yaml
check:
  framework: auto        # auto | express | hono | nextjs
  routes_dir: "src/routes"
  app_dir: "src/app"
  types_dir: "src/types"
  tests_dir: "test"
  ignore: ["**/*.generated.ts"]
```

All directory keys are optional. `app_dir` is honoured exactly as given; left
out, both `app` and `src/app` are searched. Prisma schemas are found at
`prisma/schema.prisma`, `schema.prisma` or `prisma/schema/*.prisma`.

## `agents`

Lints agent instruction files — `AGENTS.md`, `CLAUDE.md` and their nested
variants. These are **not specs**: they carry no frontmatter, they do not go in
the `specs` map, and they never enter the dependency graph, so `pack`, `diff`,
`status` and `check` do not see them. `specdx lint` reads them and never
rewrites them.

```yaml
agents:
  paths: ["AGENTS.md", "CLAUDE.md"]   # globs, relative to this file
  max_tokens: 8000                    # ceiling for one file
  rules:
    agents/stale-references: "error"  # error | warn | info | off
```

| Key | Default | Meaning |
|---|---|---|
| `paths` | `["AGENTS.md", "CLAUDE.md"]` | Globs to lint, relative to `spec.config.yaml` |
| `max_tokens` | `8000` | Token ceiling for a single file |
| `rules` | `{}` | Per-rule severity, keyed by full rule id |

Every key is optional, but in a project **with** a `spec.config.yaml` the
`agents` key itself is what turns the feature on. Without it no agent file is
linted, so upgrading specdx never adds diagnostics to a suite that did not ask
for them.

In a project with **no** `spec.config.yaml`, `specdx lint` falls back to
linting `AGENTS.md` and `CLAUDE.md` on their own, using the defaults below. It
tells you it did, so a clean agent-only run cannot be mistaken for a clean spec
suite. If there is neither a config nor an agent file, it errors as before.
A config that exists but is malformed is always an error — it never degrades to
the agent-only path, because a YAML typo silently narrowing what gets checked
would be reported as a pass.

`paths` matching no file is an **error**, not a quiet pass — a config that
promises this check and inspects nothing is worse than no config at all.

### Rules

| Rule | Default | What it asserts |
|---|---|---|
| `agents/structure` | `warn` | The file has content, and is organised under headings rather than being one undifferentiated block |
| `agents/stale-references` | `warn` | Every path the file names still exists. This is the one that does real work: a `CLAUDE.md` naming a file that moved sends every agent session to the wrong place |
| `agents/size-budget` | `warn` | The file fits `max_tokens`, counted with the same tokenizer `pack` uses, so the numbers agree |

These rules live in their own namespace and are **not** part of the `minimal`,
`recommended` or `strict` presets. `lint.extends: strict` will not promote a
finding about your `CLAUDE.md` into a build failure; only `agents.rules` sets
their severity. An unknown rule id in `agents.rules` is an error, including when
switching one `off` — a typo that silently configures nothing is how `lint.rules`
stayed inert through six audits.

### What `stale-references` treats as a claim

Only inline code spans that look like paths (`` `packages/cli/src/main.ts` ``)
and relative Markdown link targets (`[guide](docs/ci.md)`). Fenced code blocks
are skipped entirely, because they are full of illustrative paths, and a rule
that cries wolf is one people switch off.

A reference resolves if it matches a real path **by suffix**, so the shorthand
these files actually use keeps working: `` `resolver.ts` `` resolves against
`packages/pack/src/resolver.ts`. Common placeholder stems (`foo`, `bar`,
`example`, `your-app`) are never reported. A file naming no paths at all reports
an `info` notice saying so, rather than passing silently — nothing was checked,
and that is not the same as everything being fine.

## `ci`

```yaml
ci:
  block_on: ["error"]    # which severities fail the job
  post_comment: true
  update_badge: true
  trigger_paths: ["specs/**"]
```

See [CI integration](ci.md).

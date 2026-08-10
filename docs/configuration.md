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

## `ci`

```yaml
ci:
  block_on: ["error"]    # which severities fail the job
  post_comment: true
  update_badge: true
  trigger_paths: ["specs/**"]
```

See [CI integration](ci.md).

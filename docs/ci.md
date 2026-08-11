# CI integration

The GitHub Action runs lint and diff on every pull request and can block the
merge on spec health.

```yaml
# .github/workflows/specs.yml
name: specs
on: [pull_request]

permissions:
  contents: read
  pull-requests: write

jobs:
  specs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0        # diff needs history to compare refs
      - uses: umxr/specdx/packages/github-action@v0
        with:
          working-directory: .
          preset: recommended
          github-token: ${{ secrets.GITHUB_TOKEN }}
```

Pin to `@v0` to track the current major, or to an exact release like
`@v0.4.0`.

## Inputs

| Input | Default | Meaning |
|---|---|---|
| `working-directory` | `.` | Directory holding `spec.config.yaml` |
| `preset` | from config | `minimal`, `recommended` or `strict`. Beats `lint.extends`, so a PR gate can be stricter than the project default. |
| `github-token` | — | Enables the spec health comment. Omit to skip commenting. |
| `badge-path` | — | Writes an SVG health badge to this path, relative to `working-directory`. Omit to skip. |

## When the job fails

- **Any diagnostic at a severity in `ci.block_on`** (default `["error"]`).
- **Zero specs checked.** A suite whose paths resolve to no files fails rather
  than passing green. A renamed directory or a sparse checkout is a broken
  gate, not a clean one.

A missing `pull-requests: write` permission is a warning, never a failure — a
spec suite that passed should not go red because a comment could not be left.

## The spec health comment

Pass `github-token` and grant `pull-requests: write`. The action posts one
comment carrying a hidden marker and **updates it in place** on each push
rather than stacking a new one.

Turn it off in config without removing the token:

```yaml
ci:
  post_comment: false
```

Without a token the action logs why it skipped and carries on.

## Severity thresholds

```yaml
ci:
  block_on: ["error"]        # add "warn" to fail on warnings too
```

Combining `preset: strict` with `block_on: ["error"]` is the strictest useful
gate: `strict` promotes every warning to an error, so everything blocks.

## Running specdx directly

The action is a convenience. Any CI can run the CLI:

```bash
npx specdx lint --format github    # emits ::error / ::warning annotations
npx specdx status --format github
npx specdx validate
```

`--format github` produces GitHub workflow annotations that appear inline on
the pull request diff. Every command exits non-zero on failure, so no extra
wiring is needed.

### Linting one file, and why exit 3 matters

`specdx lint` takes an optional path, so a job can lint only what a pull
request touched:

```bash
npx specdx lint specs/prd.md --format github
```

| Exit | Meaning |
|---|---|
| `0` | Specs were linted and no errors were found |
| `1` | Specs were linted and at least one error was found |
| `3` | **Nothing was linted** — the path matched no spec, or `lint.ignore` excluded every one |

Exit `3` exists because "no errors" and "nothing was looked at" produce
identical output otherwise. A renamed spec would leave a job passing forever
against a path that no longer resolves. Treat `3` as a failure in CI; it means
the gate is not running, not that the specs are clean.

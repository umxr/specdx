# @specdx/lint

## 0.1.0

### Minor Changes

- ea70003: feat: make `lint.rules` and `lint.ignore` do what they have always claimed to do

  Both keys were declared in the config JSON Schema, documented in the README and
  CONTRIBUTING, and accepted by `validate` — and read by nothing. Only
  `lint.extends` was ever consumed. `consistency/naming-conventions: off` left the
  rule firing, `ignore` excluded no file, and a custom rule never loaded:
  `loadCustomRule` was implemented, exported, tested, and called from nowhere.

  A team that writes a rule override into CI believes it has configured a gate.
  The belief is the damage — this is the same silent-no-op shape as the `strict`
  preset that rewrote a severity nothing read.

  **What now works**
  - `rules: { <id>: off | false }` removes a rule. `off` and `false` both parse,
    since YAML 1.2 keeps `off` a string while `false` is a boolean.
  - `rules: { <id>: "error" | "warn" | "info" }` overrides severity, and beats the
    preset it extends. It can also re-enable a rule the preset left out, which is
    the other half of being able to turn one off.
  - `rules: { <id>: ["error", { path: "./rules/my-rule.js" }] }` loads a custom
    rule, resolved against the config directory rather than the cwd. The severity
    in the config wins over the one the rule file declares.
  - `ignore: ["specs/generated/**"]` excludes files from linting. Ignored specs
    are still passed to rules as `allSpecs`, so a reference to one still resolves —
    ignoring a file means "do not report on it", not "pretend it left the suite".

  **Nothing fails silently**
  - An unknown rule id is an error, whether it is being configured or turned off.
    A typo'd `off` used to delete nothing and look configured.
  - A value that is not a severity is an error naming what was given.
  - `lint.ignore` excluding every spec now exits 3 as "no specs were linted"
    rather than reporting a pass. Zero diagnostics because nothing was looked at
    reads identically to zero diagnostics because nothing was wrong.

  **Fixed as a class.** Six surfaces resolve lint rules — CLI `lint`, `status` and
  `ready`, the GitHub Action, and MCP `sdx_lint` and `sdx_status`. All six now go
  through one `resolveLintConfig` in `@specdx/lint`, so a change here cannot reach
  the CLI and miss the Action, which is exactly how the `lintHealth.passing` repair
  shipped half-done. Verified on all six from the built artifact.

### Patch Changes

- de09f31: Repair every defect found by the fourth audit run (against 0.4.0-alpha.20).
  - **N1 (regression from the strict-preset fix):** `--preset strict` no longer fails every suite in an environment that carries `ANTHROPIC_API_KEY`. Strict promotes warn rules to error and leaves info-class advisories (`clarity/ambiguity-score-ai`) at info — an advisory a spec edit cannot satisfy must never fail the build.
  - **N2:** `check`'s coverage score no longer barely moves when a whole type is missing. The types denominator counts fields, so the single finding for a wholly-missing type now carries its field count as `weight` and the score subtracts it. A project implementing nothing of a 5-field model scores 0 for types, not 80%.
  - **N3:** no shipped string names a bare `sdx` binary. The first-run error now says `Run 'specdx init'`, the ambiguity advisory says `specdx check --ai`, the `check`/`update` headlines and the `--ai` failure message name `specdx`, and the config schema `$id` is `specdx-config`. A packaging test greps every packed `.js`/`.md` file so the class stays closed.
  - **N4:** `runLint`, `runPack` and `scaffoldProject` now fail with a message naming the missing required option (`configDir` / `targetDir`) instead of an `ERR_INVALID_ARG_TYPE` stack trace from inside `path.join`.
  - **N5 (found re-verifying N2):** without ts-morph, type matching now skips like test matching does — unless a Prisma schema keeps types assessable. Previously every spec'd type was matched against an empty extraction and reported unimplemented when it was never looked at.

- Updated dependencies [de09f31]
  - @specdx/core@0.0.1
  - @specdx/schema@0.0.1

## 0.0.1-alpha.0

### Patch Changes

- de09f31: Repair every defect found by the fourth audit run (against 0.4.0-alpha.20).
  - **N1 (regression from the strict-preset fix):** `--preset strict` no longer fails every suite in an environment that carries `ANTHROPIC_API_KEY`. Strict promotes warn rules to error and leaves info-class advisories (`clarity/ambiguity-score-ai`) at info — an advisory a spec edit cannot satisfy must never fail the build.
  - **N2:** `check`'s coverage score no longer barely moves when a whole type is missing. The types denominator counts fields, so the single finding for a wholly-missing type now carries its field count as `weight` and the score subtracts it. A project implementing nothing of a 5-field model scores 0 for types, not 80%.
  - **N3:** no shipped string names a bare `sdx` binary. The first-run error now says `Run 'specdx init'`, the ambiguity advisory says `specdx check --ai`, the `check`/`update` headlines and the `--ai` failure message name `specdx`, and the config schema `$id` is `specdx-config`. A packaging test greps every packed `.js`/`.md` file so the class stays closed.
  - **N4:** `runLint`, `runPack` and `scaffoldProject` now fail with a message naming the missing required option (`configDir` / `targetDir`) instead of an `ERR_INVALID_ARG_TYPE` stack trace from inside `path.join`.
  - **N5 (found re-verifying N2):** without ts-morph, type matching now skips like test matching does — unless a Prisma schema keeps types assessable. Previously every spec'd type was matched against an empty extraction and reported unimplemented when it was never looked at.

- Updated dependencies [de09f31]
  - @specdx/core@0.0.1-alpha.0
  - @specdx/schema@0.0.1-alpha.0

# @specdx/core

## 0.0.1

### Patch Changes

- de09f31: Repair every defect found by the fourth audit run (against 0.4.0-alpha.20).
  - **N1 (regression from the strict-preset fix):** `--preset strict` no longer fails every suite in an environment that carries `ANTHROPIC_API_KEY`. Strict promotes warn rules to error and leaves info-class advisories (`clarity/ambiguity-score-ai`) at info — an advisory a spec edit cannot satisfy must never fail the build.
  - **N2:** `check`'s coverage score no longer barely moves when a whole type is missing. The types denominator counts fields, so the single finding for a wholly-missing type now carries its field count as `weight` and the score subtracts it. A project implementing nothing of a 5-field model scores 0 for types, not 80%.
  - **N3:** no shipped string names a bare `sdx` binary. The first-run error now says `Run 'specdx init'`, the ambiguity advisory says `specdx check --ai`, the `check`/`update` headlines and the `--ai` failure message name `specdx`, and the config schema `$id` is `specdx-config`. A packaging test greps every packed `.js`/`.md` file so the class stays closed.
  - **N4:** `runLint`, `runPack` and `scaffoldProject` now fail with a message naming the missing required option (`configDir` / `targetDir`) instead of an `ERR_INVALID_ARG_TYPE` stack trace from inside `path.join`.
  - **N5 (found re-verifying N2):** without ts-morph, type matching now skips like test matching does — unless a Prisma schema keeps types assessable. Previously every spec'd type was matched against an empty extraction and reported unimplemented when it was never looked at.

- Updated dependencies [de09f31]
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
  - @specdx/schema@0.0.1-alpha.0

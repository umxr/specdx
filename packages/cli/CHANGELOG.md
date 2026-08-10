# specdx

## 0.4.0

### Minor Changes

- a6cb2f1: feat(skills): conform to the Agent Skills specification

  Skills shipped as flat markdown files installed to `.claude/commands/`, which made them slash commands rather than skills. They now follow [agentskills.io/specification](https://agentskills.io/specification):
  - Each skill is a directory containing `SKILL.md`, with `name` matching the directory.
  - Bundled resources move to `references/` — the `specdx-author-spec` step files and the shared spec-type reference.
  - `allowed-tools` is a space-separated string, not comma-separated, and uses Claude Code prefix syntax (`Bash(npx specdx:*)`).
  - `specdx skills install` writes to `.claude/skills/<name>/SKILL.md` and copies bundled resources.
  - The Claude Code plugin manifest declares `skills` instead of `commands`, and drops a hand-maintained `version` that had drifted 13 releases behind.

  **Breaking:** skills previously installed under `.claude/commands/` are not removed. Delete the old `specdx-*.md` files there after upgrading.

- 90a10a8: fix: repair every defect found by the pre-stable audit

  A full audit of the published tarball across five sandbox projects found
  fourteen defects. Three shipped broken to users and none could fail a unit test.

  **The GitHub Action could not run at all.** Its entrypoint was gitignored, so it
  existed in no commit GitHub could check out; the build was `tsc` output that
  kept bare specifiers a runner cannot resolve; the README pointed at
  `umxr/specdx-action`, a repository that does not exist; and it documented a
  `preset` input the action never declared. The action is now bundled to a single
  committed CJS file, `preset` is implemented, the README points at the real path,
  and a workflow runs the action in a container on every push.

  **The plugin's SessionStart hook exited 126.** npm normalises non-`bin` files to
  644 when packing, so a manifest that executed the script directly failed for
  every plugin user. It is now invoked through an interpreter.

  **The published package had no README**, so the npm page was blank. It is now
  copied into the package at build time.

  Also fixed: frontmatter errors that named neither field nor allowed values;
  `story-coverage`, which warned on every real suite and passed silently on
  non-conforming ones; `check` silently ignoring a Data Model whose fields were
  not backticked, and `update` then telling authors to add fields already present;
  `generate test-plan` writing an empty spec and calling it success;
  `generate story` re-stubbing features that already had stories; `diff` leaking a
  raw git error outside a repository; `ts-morph` undeclared as an optional peer;
  ambiguous `specCount` across two MCP tools; and a README that documented three
  spec types as freeform when the linter hard-fails them.

  Each fix carries a regression test, and the packaging and documentation defects
  are now covered by assertions against the packed artifact and the README itself.

- 9d70a5a: fix: repair every defect found by the third pre-stable audit

  Six defects, found by driving the published `0.4.0-alpha.19` tarball through seven sandbox projects, an MCP stdio client and the GitHub Action under `act`. The first had never worked in any release.

  **`lint --preset strict` was a complete no-op.** `getPreset("strict")` rewrote each rule's `severity`, and the engine never read it — it collected whatever diagnostic objects the rules returned, and ten of the thirteen rules hardcoded `severity: "warn"` in the diagnostic they emitted. `strict` therefore produced output byte-identical to `recommended` on the CLI, in `extends:`, in the Action's `preset` input and in `runLint({ preset })`, so a CI gate written against it never failed. The engine now stamps the rule's declared severity onto the diagnostics that rule returned. The preset test asserted on `rule.severity` — the field nothing consumed — and now asserts on emitted diagnostics and on `hasErrors`.

  **`check` threw a stack trace when a test plan met a missing `ts-morph`.** Route and type extraction degraded to a note; test extraction was called unguarded, so one test-plan spec turned the intended skip into an unhandled error — on exactly the ephemeral-runner path the note describes, and through MCP's `sdx_check`, where the bare exception became the tool's only output. All three categories are guarded now, and the note names all three.

  **The Prisma extractor could not see a Prisma project's schema.** It read `<root>/schema.prisma` only, and `prisma init` writes `prisma/schema.prisma`. Every model was reported unimplemented and the coverage score dropped to match, with nothing said. It now reads `prisma/schema.prisma`, the project root, and the multi-file `prisma/schema/` directory, and `check` notes when a Prisma dependency is declared but no schema was found. The same shape is fixed for Next.js: `extractNextjsRoutes` defaulted to `app` alone, so `src/app` projects scanned an absent directory and reported no routes.

  **Story coverage reported a green check over a feature with no story.** A feature counted as covered at 34 % word overlap, so "Export the payroll report as PDF" was satisfied by a story about the invoice report. `lint` said nothing, `ready` asserted "All PRD features have corresponding stories", and `generate story` refused to stub the missing one — one loose threshold, three wrong answers. A story must now also pick up more than half of the words that set a feature apart from its siblings; where nothing distinguishes them, or nothing is shared, the threshold decides alone as before.

  **A type declared as a markdown table was dropped in silence.** The "no fields recognised" note fires per spec, so one readable type hid every unreadable one beside it. Tables are now read as fields when the header names a field column and a type column, and a type whose table still cannot be read is named in its own note. A heading with no field declarations at all remains prose, deliberately.

  **A test suggestion carried the spec's own markup.** An unmatched case was reported as `Add a test matching: "**TC5**: …"`. The case ID is now lifted into `SpecTestCase.id`, kept on the finding's `expected` so it stays traceable to a line in the test plan, and left out of the test name a user is asked to write.

- 8f153a3: fix: repair every defect found by the fifth audit run

  Audit run 5 confirmed all five run-4 fixes hold on every surface. It found one blocker and eight lesser defects, all fixed here.

  **F1 (blocker) — the GitHub Action passed green when it checked zero specs.** The job's verdict read only the diagnostics array, so a config whose spec paths resolved to no files produced no diagnostics and a successful job that enforced nothing. Every CLI command already guarded this; the one surface that gates CI did not. This is the vacuous-pass class re-opening: the 2026-07-30 pass fixed the Action's PR-comment renderer and declared the class closed, and the comment renderer turned out to be unreachable code.

  **F2 (medium) — `--format`, `--quiet` and `--verbose` were advertised on every command and honoured by few.** One blanket `sharedArgs` object gave nine commands a `--format` help text listing `github` while two implemented it; `validate` and `graph` ignored `--format` entirely; an unknown value fell through to pretty output with exit 0; and `--quiet` only lowered a log level while every line went out through `console.log`. Commands now declare the formats they render, an unsupported value is an error naming the supported set, `validate` and `graph` gained real JSON, `check` gained GitHub annotations, `graph --format dot` is documented, and `--quiet` suppresses success and summary output while problems still print.

  **F3 (medium) — the published `index.d.ts` exported five functions and none of their types.** `import type { PackResult } from "specdx"` failed with TS2459, so a consumer could call the API and then not annotate what it returned.

  **F4 (medium) — the `specCount` → `specFiles` rename had landed on MCP only.** CLI `status` reported `specCount` meaning spec files while `runValidate` used the same name for config entries. Renamed to `specFiles` and `specEntries` across the CLI and the library, matching MCP.

  **F5–F8 (low).** Info diagnostics render as `::notice` rather than `::warning`, so an advisory no longer reports as a warning on a clean suite. `check --verbose` says artifacts were "assessed" rather than "verified", which contradicted the failure printed two lines below. `check --ai` without a key prints a formatted error instead of an uncaught stack trace. `runStatus` and `runDiff` accept a `configDir` like `runLint` and `runPack`.

  **F9 — `completeness/edge-case-coverage` could never fire on a test plan.** It substring-matched "edge case" over the whole document while the type requires an `## Edge Cases` heading, so the required scaffolding satisfied the rule. It now judges the section's content. User-story behaviour is unchanged.

- bd51b19: Framework-agnostic checkable artifacts (#15): any spec can now declare the implementation artifacts it requires in an optional `artifacts:` frontmatter field — file paths that must exist and names they must export. `specdx check` verifies them as a new `artifact` finding category, counts them toward the implementation score, and reports them in the scan summary, so projects without a supported framework (Astro, static sites, CLIs, libraries) get real drift checking instead of "coverage not assessed". Export checks use ts-morph and are skipped with a note — never silently passed — when unavailable. Also fixes single-file `lint <path>`, which previously false-errored on cross-references because it hid the rest of the suite from the reference rule; it now lints against the full suite and reports only the target file's diagnostics.
- d246c79: Focus specdx on its core identity: the context engine for spec-driven development.
  - `check`, `check --ai`, `update --from-code`, `generate test-plan`, and `migrate` are now flagged `[experimental]` in CLI help — they remain fully functional but are not part of the stable surface
  - README rewritten around the core loop: validate → lint → pack → keep fresh
  - `status`, `ready`, `explain`, `diff`, and `changelog` now print a friendly error instead of a stack trace when no `spec.config.yaml` exists
  - MCP server: per-tool test coverage for all 7 tools and corrected server version

- b16e0e0: feat(diff): add `--working` and stop reporting a false all-clear on uncommitted specs

  `diff` compares committed refs, so uncommitted spec edits were invisible — and reported as "✓ No spec changes detected". `specdx-pre-commit` turned that into "safe to commit" at the one moment the check exists to prevent drift.

  Two changes:
  - `diff` now lists spec files changed in the working tree that the compared refs do not cover, so the green is never unqualified. Exit code is unchanged.
  - New `--working` flag (and `working` on the MCP `sdx_diff` tool) compares the base ref against the working tree, including staged, unstaged, and untracked spec files.

  The `specdx-pre-commit` and `specdx-check-drift` skills now use `--working`.

- 3daa5b5: Fix six issues found dogfooding specdx on a real project (umar.codes):
  - `--version` now reports the actual published version instead of 0.0.0 (#5)
  - `check` reports "coverage not assessed" with a distinct exit code 3 when nothing is checkable, instead of a vacuous 100% pass; `--verbose` lists what was scanned (#6)
  - `check` degrades gracefully when ts-morph is unavailable (e.g. under `pnpm dlx`): route/type extraction is skipped with an actionable note instead of a raw stack trace (#7)
  - `graph` now surfaces frontmatter `references` as labeled edges (dashed in dot output) and warns when a dependency-implying reference is not reflected in config `requires` (#8)
  - `pack` relevance: a task that names a spec's id verbatim always ranks it at 1.0, and high-relevance specs are trimmed into the remaining budget (with omission markers) instead of silently excluded (#9)
  - `ready` reports vacuous checks as "skipped" (e.g. story coverage with no PRD) rather than showing them as passes (#10)

- c6920d6: refactor: drop the `explain` command

  **Breaking:** `specdx explain` is removed, along with the programmatic `runExplain` export.

  It summarised each spec by its first non-empty line, which on a freshly scaffolded suite is the template's `<!-- placeholder -->` comment — so the one command meant to orient a new developer described every spec as a placeholder. Everything it reported is already available and correct elsewhere: `status --format json` for the project name, counts, statuses and health, `graph` for how specs relate, and `pack --full` for the content itself. The `specdx-onboard` skill now drives that sequence.

  0.x is the last cheap moment to remove a command; after a stable release it breaks users.

- 22a94b0: refactor: narrow the core command surface to the focus decision

  **Breaking:** the `specdx changelog` command is removed. It ran the same comparison as `diff` and differed only in presentation, so it is now a format: `specdx diff --format changelog`. `--from`/`--to` become `--base`/`--head`, and the programmatic `runChangelog` export is gone. The changelog output now also carries the uncommitted-specs warning, which matters most at release time.

  This narrows the core surface, so every core command traces back to the context-engine focus decision rather than to drift.

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

- b657e67: feat(lint): flag placeholder sections, and stop declaring a scaffold READY

  `specdx init` produced specs whose every section was `<!-- placeholder -->`, and `lint`, `status` and `ready` all passed them — `structure/required-sections` checks that a heading exists, never that anything was written under it.

  New rule `completeness/no-placeholder-sections` (severity `warn`) flags sections whose body is empty or only a placeholder marker, matched against the whole body so prose mentioning a TODO is untouched. `ready` gains a "Specs have content" check that fails on them, since `ready` gates on errors and a warning alone would not block the verdict.

- f65daf9: feat(skills): promote by folder, add a router, and state what success looks like

  Skills now live in bucket folders where the bucket _is_ the promotion: `core/` is what the Claude Code plugin ships and what `specdx skills install` writes; `experimental/` holds the two skills built on `sdx check` and installs only with `--experimental`. Promotion was previously an `[experimental]` string in a description — the same mechanism that let `explain` and `changelog` drift into the core CLI surface.

  New `specdx-router` skill (user-invoked) maps the workflows and the distinctions that are easy to get wrong. Every skill now ends with an **"It's working if"** section — a falsifiable success signal, so a skill can be judged to have failed.

  **Fixed:** `turbo.json` did not list skill markdown as a build input, so editing a skill did not invalidate the CLI build cache and could ship stale (#30).

  `scripts/link-skills.sh` symlinks source skills into `~/.claude/skills` for dogfooding without a rebuild.

### Patch Changes

- 4928107: Repair every defect found by the audit re-run against the published alpha.18.

  **`check` now reads a bulleted Endpoints section.** `parseEndpoints` accepted
  only `### METHOD /path` headings, so an api-contract written as a list parsed to
  zero endpoints: routes left the coverage denominator, every implemented route
  was reported as unspecified, and a genuinely absent endpoint was never
  mentioned — while the score _rose_, because understanding less removed the
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

- de09f31: Repair every defect found by the fourth audit run (against 0.4.0-alpha.20).
  - **N1 (regression from the strict-preset fix):** `--preset strict` no longer fails every suite in an environment that carries `ANTHROPIC_API_KEY`. Strict promotes warn rules to error and leaves info-class advisories (`clarity/ambiguity-score-ai`) at info — an advisory a spec edit cannot satisfy must never fail the build.
  - **N2:** `check`'s coverage score no longer barely moves when a whole type is missing. The types denominator counts fields, so the single finding for a wholly-missing type now carries its field count as `weight` and the score subtracts it. A project implementing nothing of a 5-field model scores 0 for types, not 80%.
  - **N3:** no shipped string names a bare `sdx` binary. The first-run error now says `Run 'specdx init'`, the ambiguity advisory says `specdx check --ai`, the `check`/`update` headlines and the `--ai` failure message name `specdx`, and the config schema `$id` is `specdx-config`. A packaging test greps every packed `.js`/`.md` file so the class stays closed.
  - **N4:** `runLint`, `runPack` and `scaffoldProject` now fail with a message naming the missing required option (`configDir` / `targetDir`) instead of an `ERR_INVALID_ARG_TYPE` stack trace from inside `path.join`.
  - **N5 (found re-verifying N2):** without ts-morph, type matching now skips like test matching does — unless a Prisma schema keeps types assessable. Previously every spec'd type was matched against an empty extraction and reported unimplemented when it was never looked at.

- 74de109: fix: repair both defects found by the sixth audit run

  Audit run 6 verified all ten run-5 findings fixed with no regressions, and
  surfaced two further defects in `status`. Both predate the run-5 fixes — they
  reproduce identically against `0.4.0-alpha.21` — and both are fixed here
  because the second changes the meaning of a published field, which is free now
  and breaking after `0.4.0`.
  - **G1: `status --format github` could emit nothing at all.** The formatter
    rendered stale specs and integrity issues and nothing else, so a suite whose
    only problem was lint errors produced zero bytes and exited 0 while the same
    run's JSON reported `verdict: "errors"`. A workflow step using the documented
    format showed a silent green. It now always prints a headline annotation
    carrying the project, the verdict and the counts, at the level the verdict
    reports — `::error` for `errors`, `::notice` for `healthy`, `::warning`
    otherwise — so the github and pretty renderers of one command cannot disagree.
    An `unassessed` run additionally says that nothing was assessed. Lint
    diagnostics are deliberately not re-annotated here: `lint --format github`
    owns those, and a workflow running both should not receive each twice.
  - **G2: `lintHealth.passing` subtracted a diagnostic count from a spec count.**
    `passing: specs.length - errors` reported `-6` for one spec carrying seven
    error-severity diagnostics. It now counts the specs that emitted no
    error-severity diagnostic. The mismatch survived six audits because every
    fixture exercising `status` is error-free, where `specs.length - 0` happens
    to be the right answer.

    **Fixed in two places, because there are two.** `sdx_status` duplicates the
    CLI's `runStatus` rather than calling it — the dependency runs cli → mcp, so
    it cannot be the other way round — and the first attempt at this fix repaired
    only the CLI. Re-verifying the published alpha found MCP still returning
    `-6`; a unit test on either side alone passed throughout. The duplication
    stands, but no longer silently: a new parity test in the CLI package holds
    the two implementations to the same `specFiles`, `verdict` and `lintHealth`
    on a fixture with more errors than specs, and asserts the value absolutely as
    well as relatively, since two implementations agreeing on a wrong number is
    not parity.

  Both carry regression tests that fail against the code they replace: a
  process-level pair in `cli-behaviour.test.ts` asserting `status --format github`
  is never zero bytes and annotates at its own verdict's level, and unit tests in
  `status.test.ts` covering a suite with more errors than specs and a suite whose
  only diagnostics are warnings.

- 13ec1c1: fix: carry the G2 repair into `sdx_status`, and pin the two implementations to each other

  Re-verifying `0.4.0-alpha.23` from the published tarball found `sdx_status`
  still reporting `lintHealth.passing: -6`. The G2 fix repaired the CLI's
  `runStatus` and stopped there.

  `sdx_status` duplicates `runStatus` rather than calling it — the dependency runs
  cli → mcp, so it cannot be the other way round — and nothing held the copies to
  each other. A unit test on either side alone passed throughout. The divergence
  was visible only by driving the shipped artifact, which is the whole argument
  for auditing the tarball rather than the build.

  The duplication stands: unifying it means moving `runStatus` into a package
  below the CLI, which is not a refactor to make on the eve of a stable cut. It no
  longer stands silently. `handleStatus` is now exported from `@specdx/mcp` so the
  CLI package can hold both implementations to the same `specFiles`, `verdict` and
  `lintHealth`, on fixtures covering a suite with more errors than specs, a
  healthy suite, and a suite resolving to no files. The test asserts `passing`
  absolutely as well as relatively, because two implementations agreeing on a
  wrong number is not parity. It was confirmed to fail against the pre-fix MCP
  computation before being relied on.

  The `audit-run-6-fixes` changeset is corrected in the same commit: it claimed
  the `passing` repair reached MCP, which was not true when it was written.

- d58623d: refactor: promote CLI commands by folder

  Command modules now live in `core/` or `experimental/` buckets, and the
  `[experimental]` caveat is derived from the bucket at render time rather than
  typed into each description. No file under `commands/` spells the marker any
  more, so the folder and the label cannot disagree.

  Sub-commands carry their own bucket: `generate` is promoted, `generate
test-plan` is not, and the caveat now reaches it from its own folder instead of
  a hand-written string.

  Nothing changes for a user — `--help` renders the same labels — but the
  conformance test now fails when a command's promotion drifts from how it
  describes itself, including in the README's CLI reference. This is the drift
  that quietly moved `explain` and `changelog` into the core surface.

- ea70003: docs: restructure the README around a quick start, and fix what was wrong

  The README was ~3,500 words of narrative walkthrough with the first runnable
  command buried past a five-template comparison table. It is now ~1,250 words:
  what specdx is, a working quick start inside the first screenful, the loop,
  the essentials of config and spec format, and links out to reference docs —
  the shape common to well-regarded tool READMEs, and what the research on
  scannability recommends.

  Reference material moved out of the README rather than being deleted:
  `docs/spec-format.md` (all nine types, cross-references, declared artifacts,
  the three sections `check` parses), `docs/configuration.md` (every config key,
  including the newly working `lint.rules` and `lint.ignore`) and `docs/ci.md`.

  **Corrections, each verified against the published CLI:**
  - The README claimed **9 skills** and its table omitted `specdx-router`. Ten
    ship.
  - The CI snippet pinned `umxr/specdx/packages/github-action@v0.4.0`, **a tag
    nothing ever created**. changesets tags releases `specdx@0.4.0`, and GitHub
    parses `owner/repo/path@ref` by splitting on the last `@`, so that tag can
    never be a `uses:` ref. The release workflow now pushes `v<version>` and a
    moving `v<major>` after a stable publish, and the docs pin `@v0`.
  - "Global flags: `--quiet` and `--verbose`" was false. `init`, `skills`,
    `generate` and `mcp` have neither; `migrate` has no `--verbose`.
  - `init --help` advertised three templates while accepting five. The help text
    is now derived from the same list the validator uses, so they cannot disagree.
  - `docs/other-platforms.md` said specdx "ships two skills", pointed every copy
    command at `node_modules/specdx/skills/*.md` — a path that does not exist,
    since skills live at `dist/skills/<bucket>/<name>/SKILL.md` — and told users
    to run `specdx skills --list`, which is not a command.
  - CONTRIBUTING told contributors to run `pnpm lint` (the script is `lint:code`;
    `pnpm lint` exits 254) and `sdx lint` after `npm link` (the binary is
    `specdx`), listed four rule namespaces where six exist, claimed
    `moduleResolution: "bundler"` where it is `NodeNext`, and omitted `epic`,
    `quick-spec` and `project-context` from its `SpecType` examples.

  **New guards**, because prose drifts faster than code: the spec-type table is
  checked against `REQUIRED_SECTIONS` at its new location, every `uses:` ref must
  match a tag pattern the release workflow demonstrably creates, every documented
  config section must exist in the schema and every schema `lint` key must be
  documented, and every relative link in the README must resolve. The link guard
  was confirmed to fail on a broken link before being relied on.

- 51aa872: fix(diff): resolve spec entries declared by a glob path

  `diff` matched changed files against config `path` values by string equality, so a glob entry (`specs/stories/*.md`) matched nothing and every spec behind it was invisible — reported as "no spec changes detected" and omitted from downstream impact. Paths are now matched as patterns, and globs expand against the compared ref rather than the working tree. Spec ids for added and removed files come from their frontmatter instead of the config entry key. Affects CLI `diff`, CLI `changelog`, the MCP `diff` tool, and the GitHub Action.

- 7f14d95: Fix two issues from umar.codes dogfooding round 3:
  - `pack` no longer silently truncates trimmed specs: omission markers are now guaranteed — their token cost is reserved before sections are kept, so a trimmed spec can never read as complete. Each cut gets one marker naming the omitted sections (e.g. `[2 sections omitted to fit token budget: Data Model, API Design]`), and a new `Sections omitted` counter surfaces in dry-run output, the token report, and the XML/JSON formats (#12)
  - `decomposed-into` is no longer treated as dependency-implying, so `graph` stops suggesting inverted `requires` edges for parent→child decomposition; suggestions are now cycle-checked before printing (cycle-creating ones become an explicit conflict warning instead), and `validate` now builds the dependency graph, failing on circular or dangling `requires` chains instead of accepting them (#13)

- aa06215: fix(mcp): ship the MCP server's runtime dependencies

  `specdx mcp` failed with `ERR_MODULE_NOT_FOUND` for every npm install. `@modelcontextprotocol/sdk` and `zod` were marked external in the bundle and declared only on the unpublished `@specdx/mcp` package, so nothing supplied them at runtime. They are now dependencies of `specdx`, the import failure reports an actionable message instead of a raw stack trace on the stdio transport, and a packaging test asserts every external is either declared or an allowlisted optional dependency.

- 40d0fd5: fix(pack): stop collapsing stale specs when the budget has room for them

  `pack` compressed every spec untouched for `stable_days` (7 by default) before
  it ever consulted the budget, so a suite that fitted comfortably still came back
  as `[Unchanged since … — N tokens omitted]` stubs. On specdx's own specs that
  meant 1,457 of 12,000 tokens used and 20 sections stubbed, when the whole suite
  fits in 8,056. Specs that have not changed in a week are the normal case, so the
  default configuration degraded almost every real suite — silently, since
  `used=1457 budget=12000 omitted=0` reads like a healthy pack.

  The staleness collapse is now a response to budget pressure: full content is
  used when it fits, and stale specs collapse from least relevant upward only
  until the suite fits. Boilerplate stripping and superseded-ADR collapse are
  unchanged — those are hygiene at any budget.

  Fixes #33.

- 95ff07d: fix(pack): report when nothing was packed instead of emitting an empty context

  `pack` wrote an empty `<context>` to stdout and exited 0 when no spec was selected, which reads as a successful pack to whatever consumes it. It now explains why — config resolved nothing, everything scored below the relevance threshold, or all candidates were excluded — and exits 3, matching `lint` and `check`. The dry run reports the same, and both now count against the number of specs actually resolved rather than the post-threshold candidates.

- 0a78530: Declared `exports` now follow the same spec-status rule as declared file paths (#19). The #17 fix gated only file existence, so a `draft` spec that planned a new export on an already-existing file still failed with an error and exit 1 — the same friction #17 removed, reached by a different path, and it made the workaround worse because the `artifacts:` block could be only half-declared. A missing export is now `pending` (info, excluded from the score, exit 0) while the spec is `draft`, `review`, or `superseded`, and an enforced error once it is `approved`, with suggestion wording that reads as a plan rather than a defect. Exports that already exist are verified regardless of status.
- 77484e0: Declared artifacts are enforced by spec status, so spec-first authoring no longer breaks the check gate (#17). A spec that is `draft`, `review`, or `superseded` reports declared-but-absent files as **pending** — an info finding, excluded from the score, exit 0 — because a spec written before its implementation is a plan, not a defect. Once the spec is `approved` the same absence is a missing-artifact error that exits 1, which gives `check` a signal it could not express before: "this spec is approved but its artifacts do not exist" is drift, and is different from "this spec is a draft and nothing is built yet". Artifacts that do exist are verified regardless of status. Pending counts appear in the verbose scan summary and in the notes.
- 55eb27b: fix(plugin): repair the hooks manifest and keep plugin versions in sync

  `claude plugin validate --strict` failed: `hooks.json` used an array where the schema expects a record keyed by event name, and `plugin.json` never referenced it — so the `SessionStart` hook never loaded for plugin users. The hook path now uses `${CLAUDE_PLUGIN_ROOT}`.

  Plugin manifest versions were hand-maintained and had drifted: the Claude manifest carried none and the Cursor manifest was 13 releases behind. `scripts/sync-plugin-version.mjs` now stamps them during `changeset version`, and `pnpm check-plugin-version` guards it in CI.

- 72d0d82: Reconcile config `requires` and frontmatter `references` (ADR: references/requires unification, Option B). The two declaration styles now give the same answer to "what is upstream/downstream of this spec?", which fixes two silent failures:
  - `freshness/staleness-check` read only frontmatter references, so a suite declaring dependencies through config `requires` alone got **no** relative-staleness warnings. It now reads both.
  - Downstream impact analysis ran a graph walk keyed by config entry name using a spec id, so `diff` reported no downstream impact whenever entry keys differed from spec ids — which is most suites. Impact now works in spec id space.

  The dependency-implying relationship taxonomy moved from a constant in `@specdx/core` into `@specdx/schema` as `SPEC_RELATIONSHIPS` and `DEPENDENCY_RELATIONSHIPS`, drift-tested against `base-spec.json` the same way spec types already are, so a relationship kind can no longer be added without declaring its dependency semantics. A new `buildRelationResolver` export unions both sources and tags each edge `requires`, `references`, or `both`.

  One behaviour change to expect: `implemented-by` is now read in the documented direction throughout ("A is implemented-by B" means B depends on A); the staleness rule previously inverted it. Suites that declare dependencies only in config `requires` may see staleness warnings they have not seen before — that is the fix working.

  No change to `spec.config.yaml` or the frontmatter schema.

- 7591c43: `generate story` now truncates long filenames on a word boundary instead of cutting mid-word (`...-rules-across.md` rather than `...-rules-across-st.md`).
- 7374dbd: Close out the vacuous-pass bug class (follow-up to #6, #10, #12): a suite whose spec paths resolve to no files no longer reports success from any command.
  - `validate` now resolves every declared spec path: a `required` entry matching no files is invalid, an optional entry matching nothing warns, and an entirely empty suite warns that downstream checks would pass vacuously. Output distinguishes spec _entries_ from resolved spec _files_.
  - `lint` reports "no specs found — nothing was linted" and exits 3 (matching `check`'s not-assessed convention) instead of "✓ All specs pass lint checks".
  - `status` gains an `unassessed` verdict for an empty suite instead of reporting "healthy" (CLI and MCP).
  - `ready` gains a "Spec suite non-empty" check, and its lint-health and staleness checks now report as skipped rather than ticking over an empty set.
  - The GitHub Action PR comment no longer renders a green check for "0 specs checked", so a misconfigured glob cannot show green in CI.

## 0.4.0-alpha.24

### Patch Changes

- 13ec1c1: fix: carry the G2 repair into `sdx_status`, and pin the two implementations to each other

  Re-verifying `0.4.0-alpha.23` from the published tarball found `sdx_status`
  still reporting `lintHealth.passing: -6`. The G2 fix repaired the CLI's
  `runStatus` and stopped there.

  `sdx_status` duplicates `runStatus` rather than calling it — the dependency runs
  cli → mcp, so it cannot be the other way round — and nothing held the copies to
  each other. A unit test on either side alone passed throughout. The divergence
  was visible only by driving the shipped artifact, which is the whole argument
  for auditing the tarball rather than the build.

  The duplication stands: unifying it means moving `runStatus` into a package
  below the CLI, which is not a refactor to make on the eve of a stable cut. It no
  longer stands silently. `handleStatus` is now exported from `@specdx/mcp` so the
  CLI package can hold both implementations to the same `specFiles`, `verdict` and
  `lintHealth`, on fixtures covering a suite with more errors than specs, a
  healthy suite, and a suite resolving to no files. The test asserts `passing`
  absolutely as well as relatively, because two implementations agreeing on a
  wrong number is not parity. It was confirmed to fail against the pre-fix MCP
  computation before being relied on.

  The `audit-run-6-fixes` changeset is corrected in the same commit: it claimed
  the `passing` repair reached MCP, which was not true when it was written.

## 0.4.0-alpha.23

### Patch Changes

- 74de109: fix: repair both defects found by the sixth audit run

  Audit run 6 verified all ten run-5 findings fixed with no regressions, and
  surfaced two further defects in `status`. Both predate the run-5 fixes — they
  reproduce identically against `0.4.0-alpha.21` — and both are fixed here
  because the second changes the meaning of a published field, which is free now
  and breaking after `0.4.0`.
  - **G1: `status --format github` could emit nothing at all.** The formatter
    rendered stale specs and integrity issues and nothing else, so a suite whose
    only problem was lint errors produced zero bytes and exited 0 while the same
    run's JSON reported `verdict: "errors"`. A workflow step using the documented
    format showed a silent green. It now always prints a headline annotation
    carrying the project, the verdict and the counts, at the level the verdict
    reports — `::error` for `errors`, `::notice` for `healthy`, `::warning`
    otherwise — so the github and pretty renderers of one command cannot disagree.
    An `unassessed` run additionally says that nothing was assessed. Lint
    diagnostics are deliberately not re-annotated here: `lint --format github`
    owns those, and a workflow running both should not receive each twice.
  - **G2: `lintHealth.passing` subtracted a diagnostic count from a spec count.**
    `passing: specs.length - errors` reported `-6` for one spec carrying seven
    error-severity diagnostics. It now counts the specs that emitted no
    error-severity diagnostic. The field is part of the published `StatusResult`,
    so this reaches the library and `sdx_status` over MCP as well as
    `status --format json`. The mismatch survived six audits because every
    fixture exercising `status` is error-free, where `specs.length - 0` happens
    to be the right answer.

  Both carry regression tests that fail against the code they replace: a
  process-level pair in `cli-behaviour.test.ts` asserting `status --format github`
  is never zero bytes and annotates at its own verdict's level, and unit tests in
  `status.test.ts` covering a suite with more errors than specs and a suite whose
  only diagnostics are warnings.

## 0.4.0-alpha.22

### Minor Changes

- 8f153a3: fix: repair every defect found by the fifth audit run

  Audit run 5 confirmed all five run-4 fixes hold on every surface. It found one blocker and eight lesser defects, all fixed here.

  **F1 (blocker) — the GitHub Action passed green when it checked zero specs.** The job's verdict read only the diagnostics array, so a config whose spec paths resolved to no files produced no diagnostics and a successful job that enforced nothing. Every CLI command already guarded this; the one surface that gates CI did not. This is the vacuous-pass class re-opening: the 2026-07-30 pass fixed the Action's PR-comment renderer and declared the class closed, and the comment renderer turned out to be unreachable code.

  **F2 (medium) — `--format`, `--quiet` and `--verbose` were advertised on every command and honoured by few.** One blanket `sharedArgs` object gave nine commands a `--format` help text listing `github` while two implemented it; `validate` and `graph` ignored `--format` entirely; an unknown value fell through to pretty output with exit 0; and `--quiet` only lowered a log level while every line went out through `console.log`. Commands now declare the formats they render, an unsupported value is an error naming the supported set, `validate` and `graph` gained real JSON, `check` gained GitHub annotations, `graph --format dot` is documented, and `--quiet` suppresses success and summary output while problems still print.

  **F3 (medium) — the published `index.d.ts` exported five functions and none of their types.** `import type { PackResult } from "specdx"` failed with TS2459, so a consumer could call the API and then not annotate what it returned.

  **F4 (medium) — the `specCount` → `specFiles` rename had landed on MCP only.** CLI `status` reported `specCount` meaning spec files while `runValidate` used the same name for config entries. Renamed to `specFiles` and `specEntries` across the CLI and the library, matching MCP.

  **F5–F8 (low).** Info diagnostics render as `::notice` rather than `::warning`, so an advisory no longer reports as a warning on a clean suite. `check --verbose` says artifacts were "assessed" rather than "verified", which contradicted the failure printed two lines below. `check --ai` without a key prints a formatted error instead of an uncaught stack trace. `runStatus` and `runDiff` accept a `configDir` like `runLint` and `runPack`.

  **F9 — `completeness/edge-case-coverage` could never fire on a test plan.** It substring-matched "edge case" over the whole document while the type requires an `## Edge Cases` heading, so the required scaffolding satisfied the rule. It now judges the section's content. User-story behaviour is unchanged.

## 0.4.0-alpha.21

### Patch Changes

- de09f31: Repair every defect found by the fourth audit run (against 0.4.0-alpha.20).
  - **N1 (regression from the strict-preset fix):** `--preset strict` no longer fails every suite in an environment that carries `ANTHROPIC_API_KEY`. Strict promotes warn rules to error and leaves info-class advisories (`clarity/ambiguity-score-ai`) at info — an advisory a spec edit cannot satisfy must never fail the build.
  - **N2:** `check`'s coverage score no longer barely moves when a whole type is missing. The types denominator counts fields, so the single finding for a wholly-missing type now carries its field count as `weight` and the score subtracts it. A project implementing nothing of a 5-field model scores 0 for types, not 80%.
  - **N3:** no shipped string names a bare `sdx` binary. The first-run error now says `Run 'specdx init'`, the ambiguity advisory says `specdx check --ai`, the `check`/`update` headlines and the `--ai` failure message name `specdx`, and the config schema `$id` is `specdx-config`. A packaging test greps every packed `.js`/`.md` file so the class stays closed.
  - **N4:** `runLint`, `runPack` and `scaffoldProject` now fail with a message naming the missing required option (`configDir` / `targetDir`) instead of an `ERR_INVALID_ARG_TYPE` stack trace from inside `path.join`.
  - **N5 (found re-verifying N2):** without ts-morph, type matching now skips like test matching does — unless a Prisma schema keeps types assessable. Previously every spec'd type was matched against an empty extraction and reported unimplemented when it was never looked at.

## 0.4.0-alpha.20

### Minor Changes

- 9d70a5a: fix: repair every defect found by the third pre-stable audit

  Six defects, found by driving the published `0.4.0-alpha.19` tarball through seven sandbox projects, an MCP stdio client and the GitHub Action under `act`. The first had never worked in any release.

  **`lint --preset strict` was a complete no-op.** `getPreset("strict")` rewrote each rule's `severity`, and the engine never read it — it collected whatever diagnostic objects the rules returned, and ten of the thirteen rules hardcoded `severity: "warn"` in the diagnostic they emitted. `strict` therefore produced output byte-identical to `recommended` on the CLI, in `extends:`, in the Action's `preset` input and in `runLint({ preset })`, so a CI gate written against it never failed. The engine now stamps the rule's declared severity onto the diagnostics that rule returned. The preset test asserted on `rule.severity` — the field nothing consumed — and now asserts on emitted diagnostics and on `hasErrors`.

  **`check` threw a stack trace when a test plan met a missing `ts-morph`.** Route and type extraction degraded to a note; test extraction was called unguarded, so one test-plan spec turned the intended skip into an unhandled error — on exactly the ephemeral-runner path the note describes, and through MCP's `sdx_check`, where the bare exception became the tool's only output. All three categories are guarded now, and the note names all three.

  **The Prisma extractor could not see a Prisma project's schema.** It read `<root>/schema.prisma` only, and `prisma init` writes `prisma/schema.prisma`. Every model was reported unimplemented and the coverage score dropped to match, with nothing said. It now reads `prisma/schema.prisma`, the project root, and the multi-file `prisma/schema/` directory, and `check` notes when a Prisma dependency is declared but no schema was found. The same shape is fixed for Next.js: `extractNextjsRoutes` defaulted to `app` alone, so `src/app` projects scanned an absent directory and reported no routes.

  **Story coverage reported a green check over a feature with no story.** A feature counted as covered at 34 % word overlap, so "Export the payroll report as PDF" was satisfied by a story about the invoice report. `lint` said nothing, `ready` asserted "All PRD features have corresponding stories", and `generate story` refused to stub the missing one — one loose threshold, three wrong answers. A story must now also pick up more than half of the words that set a feature apart from its siblings; where nothing distinguishes them, or nothing is shared, the threshold decides alone as before.

  **A type declared as a markdown table was dropped in silence.** The "no fields recognised" note fires per spec, so one readable type hid every unreadable one beside it. Tables are now read as fields when the header names a field column and a type column, and a type whose table still cannot be read is named in its own note. A heading with no field declarations at all remains prose, deliberately.

  **A test suggestion carried the spec's own markup.** An unmatched case was reported as `Add a test matching: "**TC5**: …"`. The case ID is now lifted into `SpecTestCase.id`, kept on the finding's `expected` so it stays traceable to a line in the test plan, and left out of the test name a user is asked to write.

## 0.4.0-alpha.19

### Patch Changes

- 4928107: Repair every defect found by the audit re-run against the published alpha.18.

  **`check` now reads a bulleted Endpoints section.** `parseEndpoints` accepted
  only `### METHOD /path` headings, so an api-contract written as a list parsed to
  zero endpoints: routes left the coverage denominator, every implemented route
  was reported as unspecified, and a genuinely absent endpoint was never
  mentioned — while the score _rose_, because understanding less removed the
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

## 0.4.0-alpha.18

### Minor Changes

- 90a10a8: fix: repair every defect found by the pre-stable audit

  A full audit of the published tarball across five sandbox projects found
  fourteen defects. Three shipped broken to users and none could fail a unit test.

  **The GitHub Action could not run at all.** Its entrypoint was gitignored, so it
  existed in no commit GitHub could check out; the build was `tsc` output that
  kept bare specifiers a runner cannot resolve; the README pointed at
  `umxr/specdx-action`, a repository that does not exist; and it documented a
  `preset` input the action never declared. The action is now bundled to a single
  committed CJS file, `preset` is implemented, the README points at the real path,
  and a workflow runs the action in a container on every push.

  **The plugin's SessionStart hook exited 126.** npm normalises non-`bin` files to
  644 when packing, so a manifest that executed the script directly failed for
  every plugin user. It is now invoked through an interpreter.

  **The published package had no README**, so the npm page was blank. It is now
  copied into the package at build time.

  Also fixed: frontmatter errors that named neither field nor allowed values;
  `story-coverage`, which warned on every real suite and passed silently on
  non-conforming ones; `check` silently ignoring a Data Model whose fields were
  not backticked, and `update` then telling authors to add fields already present;
  `generate test-plan` writing an empty spec and calling it success;
  `generate story` re-stubbing features that already had stories; `diff` leaking a
  raw git error outside a repository; `ts-morph` undeclared as an optional peer;
  ambiguous `specCount` across two MCP tools; and a README that documented three
  spec types as freeform when the linter hard-fails them.

  Each fix carries a regression test, and the packaging and documentation defects
  are now covered by assertions against the packed artifact and the README itself.

## 0.4.0-alpha.17

### Minor Changes

- c6920d6: refactor: drop the `explain` command

  **Breaking:** `specdx explain` is removed, along with the programmatic `runExplain` export.

  It summarised each spec by its first non-empty line, which on a freshly scaffolded suite is the template's `<!-- placeholder -->` comment — so the one command meant to orient a new developer described every spec as a placeholder. Everything it reported is already available and correct elsewhere: `status --format json` for the project name, counts, statuses and health, `graph` for how specs relate, and `pack --full` for the content itself. The `specdx-onboard` skill now drives that sequence.

  0.x is the last cheap moment to remove a command; after a stable release it breaks users.

### Patch Changes

- d58623d: refactor: promote CLI commands by folder

  Command modules now live in `core/` or `experimental/` buckets, and the
  `[experimental]` caveat is derived from the bucket at render time rather than
  typed into each description. No file under `commands/` spells the marker any
  more, so the folder and the label cannot disagree.

  Sub-commands carry their own bucket: `generate` is promoted, `generate
test-plan` is not, and the caveat now reaches it from its own folder instead of
  a hand-written string.

  Nothing changes for a user — `--help` renders the same labels — but the
  conformance test now fails when a command's promotion drifts from how it
  describes itself, including in the README's CLI reference. This is the drift
  that quietly moved `explain` and `changelog` into the core surface.

- 40d0fd5: fix(pack): stop collapsing stale specs when the budget has room for them

  `pack` compressed every spec untouched for `stable_days` (7 by default) before
  it ever consulted the budget, so a suite that fitted comfortably still came back
  as `[Unchanged since … — N tokens omitted]` stubs. On specdx's own specs that
  meant 1,457 of 12,000 tokens used and 20 sections stubbed, when the whole suite
  fits in 8,056. Specs that have not changed in a week are the normal case, so the
  default configuration degraded almost every real suite — silently, since
  `used=1457 budget=12000 omitted=0` reads like a healthy pack.

  The staleness collapse is now a response to budget pressure: full content is
  used when it fits, and stale specs collapse from least relevant upward only
  until the suite fits. Boilerplate stripping and superseded-ADR collapse are
  unchanged — those are hygiene at any budget.

  Fixes #33.

## 0.4.0-alpha.16

### Minor Changes

- f65daf9: feat(skills): promote by folder, add a router, and state what success looks like

  Skills now live in bucket folders where the bucket _is_ the promotion: `core/` is what the Claude Code plugin ships and what `specdx skills install` writes; `experimental/` holds the two skills built on `sdx check` and installs only with `--experimental`. Promotion was previously an `[experimental]` string in a description — the same mechanism that let `explain` and `changelog` drift into the core CLI surface.

  New `specdx-router` skill (user-invoked) maps the workflows and the distinctions that are easy to get wrong. Every skill now ends with an **"It's working if"** section — a falsifiable success signal, so a skill can be judged to have failed.

  **Fixed:** `turbo.json` did not list skill markdown as a build input, so editing a skill did not invalidate the CLI build cache and could ship stale (#30).

  `scripts/link-skills.sh` symlinks source skills into `~/.claude/skills` for dogfooding without a rebuild.

## 0.4.0-alpha.15

### Minor Changes

- a6cb2f1: feat(skills): conform to the Agent Skills specification

  Skills shipped as flat markdown files installed to `.claude/commands/`, which made them slash commands rather than skills. They now follow [agentskills.io/specification](https://agentskills.io/specification):
  - Each skill is a directory containing `SKILL.md`, with `name` matching the directory.
  - Bundled resources move to `references/` — the `specdx-author-spec` step files and the shared spec-type reference.
  - `allowed-tools` is a space-separated string, not comma-separated, and uses Claude Code prefix syntax (`Bash(npx specdx:*)`).
  - `specdx skills install` writes to `.claude/skills/<name>/SKILL.md` and copies bundled resources.
  - The Claude Code plugin manifest declares `skills` instead of `commands`, and drops a hand-maintained `version` that had drifted 13 releases behind.

  **Breaking:** skills previously installed under `.claude/commands/` are not removed. Delete the old `specdx-*.md` files there after upgrading.

### Patch Changes

- 55eb27b: fix(plugin): repair the hooks manifest and keep plugin versions in sync

  `claude plugin validate --strict` failed: `hooks.json` used an array where the schema expects a record keyed by event name, and `plugin.json` never referenced it — so the `SessionStart` hook never loaded for plugin users. The hook path now uses `${CLAUDE_PLUGIN_ROOT}`.

  Plugin manifest versions were hand-maintained and had drifted: the Claude manifest carried none and the Cursor manifest was 13 releases behind. `scripts/sync-plugin-version.mjs` now stamps them during `changeset version`, and `pnpm check-plugin-version` guards it in CI.

## 0.4.0-alpha.14

### Minor Changes

- 22a94b0: refactor: narrow the core command surface to the focus decision

  **Breaking:** the `specdx changelog` command is removed. It ran the same comparison as `diff` and differed only in presentation, so it is now a format: `specdx diff --format changelog`. `--from`/`--to` become `--base`/`--head`, and the programmatic `runChangelog` export is gone. The changelog output now also carries the uncommitted-specs warning, which matters most at release time.

  `specdx explain` is flagged `[experimental]` until its output earns a core slot.

  This takes the core surface from 13 commands to 11, so every core command traces back to the context-engine focus decision rather than to drift.

## 0.4.0-alpha.13

### Minor Changes

- b657e67: feat(lint): flag placeholder sections, and stop declaring a scaffold READY

  `specdx init` produced specs whose every section was `<!-- placeholder -->`, and `lint`, `status` and `ready` all passed them — `structure/required-sections` checks that a heading exists, never that anything was written under it.

  New rule `completeness/no-placeholder-sections` (severity `warn`) flags sections whose body is empty or only a placeholder marker, matched against the whole body so prose mentioning a TODO is untouched. `ready` gains a "Specs have content" check that fails on them, since `ready` gates on errors and a warning alone would not block the verdict.

### Patch Changes

- aa06215: fix(mcp): ship the MCP server's runtime dependencies

  `specdx mcp` failed with `ERR_MODULE_NOT_FOUND` for every npm install. `@modelcontextprotocol/sdk` and `zod` were marked external in the bundle and declared only on the unpublished `@specdx/mcp` package, so nothing supplied them at runtime. They are now dependencies of `specdx`, the import failure reports an actionable message instead of a raw stack trace on the stdio transport, and a packaging test asserts every external is either declared or an allowlisted optional dependency.

- 95ff07d: fix(pack): report when nothing was packed instead of emitting an empty context

  `pack` wrote an empty `<context>` to stdout and exited 0 when no spec was selected, which reads as a successful pack to whatever consumes it. It now explains why — config resolved nothing, everything scored below the relevance threshold, or all candidates were excluded — and exits 3, matching `lint` and `check`. The dry run reports the same, and both now count against the number of specs actually resolved rather than the post-threshold candidates.

## 0.4.0-alpha.12

### Minor Changes

- b16e0e0: feat(diff): add `--working` and stop reporting a false all-clear on uncommitted specs

  `diff` compares committed refs, so uncommitted spec edits were invisible — and reported as "✓ No spec changes detected". `specdx-pre-commit` turned that into "safe to commit" at the one moment the check exists to prevent drift.

  Two changes:
  - `diff` now lists spec files changed in the working tree that the compared refs do not cover, so the green is never unqualified. Exit code is unchanged.
  - New `--working` flag (and `working` on the MCP `sdx_diff` tool) compares the base ref against the working tree, including staged, unstaged, and untracked spec files.

  The `specdx-pre-commit` and `specdx-check-drift` skills now use `--working`.

### Patch Changes

- 51aa872: fix(diff): resolve spec entries declared by a glob path

  `diff` matched changed files against config `path` values by string equality, so a glob entry (`specs/stories/*.md`) matched nothing and every spec behind it was invisible — reported as "no spec changes detected" and omitted from downstream impact. Paths are now matched as patterns, and globs expand against the compared ref rather than the working tree. Spec ids for added and removed files come from their frontmatter instead of the config entry key. Affects CLI `diff`, CLI `changelog`, the MCP `diff` tool, and the GitHub Action.

## 0.4.0-alpha.11

### Patch Changes

- 0a78530: Declared `exports` now follow the same spec-status rule as declared file paths (#19). The #17 fix gated only file existence, so a `draft` spec that planned a new export on an already-existing file still failed with an error and exit 1 — the same friction #17 removed, reached by a different path, and it made the workaround worse because the `artifacts:` block could be only half-declared. A missing export is now `pending` (info, excluded from the score, exit 0) while the spec is `draft`, `review`, or `superseded`, and an enforced error once it is `approved`, with suggestion wording that reads as a plan rather than a defect. Exports that already exist are verified regardless of status.

## 0.4.0-alpha.10

### Patch Changes

- 72d0d82: Reconcile config `requires` and frontmatter `references` (ADR: references/requires unification, Option B). The two declaration styles now give the same answer to "what is upstream/downstream of this spec?", which fixes two silent failures:
  - `freshness/staleness-check` read only frontmatter references, so a suite declaring dependencies through config `requires` alone got **no** relative-staleness warnings. It now reads both.
  - Downstream impact analysis ran a graph walk keyed by config entry name using a spec id, so `diff` reported no downstream impact whenever entry keys differed from spec ids — which is most suites. Impact now works in spec id space.

  The dependency-implying relationship taxonomy moved from a constant in `@specdx/core` into `@specdx/schema` as `SPEC_RELATIONSHIPS` and `DEPENDENCY_RELATIONSHIPS`, drift-tested against `base-spec.json` the same way spec types already are, so a relationship kind can no longer be added without declaring its dependency semantics. A new `buildRelationResolver` export unions both sources and tags each edge `requires`, `references`, or `both`.

  One behaviour change to expect: `implemented-by` is now read in the documented direction throughout ("A is implemented-by B" means B depends on A); the staleness rule previously inverted it. Suites that declare dependencies only in config `requires` may see staleness warnings they have not seen before — that is the fix working.

  No change to `spec.config.yaml` or the frontmatter schema.

## 0.4.0-alpha.9

### Patch Changes

- 77484e0: Declared artifacts are enforced by spec status, so spec-first authoring no longer breaks the check gate (#17). A spec that is `draft`, `review`, or `superseded` reports declared-but-absent files as **pending** — an info finding, excluded from the score, exit 0 — because a spec written before its implementation is a plan, not a defect. Once the spec is `approved` the same absence is a missing-artifact error that exits 1, which gives `check` a signal it could not express before: "this spec is approved but its artifacts do not exist" is drift, and is different from "this spec is a draft and nothing is built yet". Artifacts that do exist are verified regardless of status. Pending counts appear in the verbose scan summary and in the notes.
- 7374dbd: Close out the vacuous-pass bug class (follow-up to #6, #10, #12): a suite whose spec paths resolve to no files no longer reports success from any command.
  - `validate` now resolves every declared spec path: a `required` entry matching no files is invalid, an optional entry matching nothing warns, and an entirely empty suite warns that downstream checks would pass vacuously. Output distinguishes spec _entries_ from resolved spec _files_.
  - `lint` reports "no specs found — nothing was linted" and exits 3 (matching `check`'s not-assessed convention) instead of "✓ All specs pass lint checks".
  - `status` gains an `unassessed` verdict for an empty suite instead of reporting "healthy" (CLI and MCP).
  - `ready` gains a "Spec suite non-empty" check, and its lint-health and staleness checks now report as skipped rather than ticking over an empty set.
  - The GitHub Action PR comment no longer renders a green check for "0 specs checked", so a misconfigured glob cannot show green in CI.

## 0.4.0-alpha.8

### Minor Changes

- bd51b19: Framework-agnostic checkable artifacts (#15): any spec can now declare the implementation artifacts it requires in an optional `artifacts:` frontmatter field — file paths that must exist and names they must export. `specdx check` verifies them as a new `artifact` finding category, counts them toward the implementation score, and reports them in the scan summary, so projects without a supported framework (Astro, static sites, CLIs, libraries) get real drift checking instead of "coverage not assessed". Export checks use ts-morph and are skipped with a note — never silently passed — when unavailable. Also fixes single-file `lint <path>`, which previously false-errored on cross-references because it hid the rest of the suite from the reference rule; it now lints against the full suite and reports only the target file's diagnostics.

## 0.4.0-alpha.7

### Patch Changes

- 7f14d95: Fix two issues from umar.codes dogfooding round 3:
  - `pack` no longer silently truncates trimmed specs: omission markers are now guaranteed — their token cost is reserved before sections are kept, so a trimmed spec can never read as complete. Each cut gets one marker naming the omitted sections (e.g. `[2 sections omitted to fit token budget: Data Model, API Design]`), and a new `Sections omitted` counter surfaces in dry-run output, the token report, and the XML/JSON formats (#12)
  - `decomposed-into` is no longer treated as dependency-implying, so `graph` stops suggesting inverted `requires` edges for parent→child decomposition; suggestions are now cycle-checked before printing (cycle-creating ones become an explicit conflict warning instead), and `validate` now builds the dependency graph, failing on circular or dangling `requires` chains instead of accepting them (#13)

## 0.4.0-alpha.6

### Minor Changes

- 3daa5b5: Fix six issues found dogfooding specdx on a real project (umar.codes):
  - `--version` now reports the actual published version instead of 0.0.0 (#5)
  - `check` reports "coverage not assessed" with a distinct exit code 3 when nothing is checkable, instead of a vacuous 100% pass; `--verbose` lists what was scanned (#6)
  - `check` degrades gracefully when ts-morph is unavailable (e.g. under `pnpm dlx`): route/type extraction is skipped with an actionable note instead of a raw stack trace (#7)
  - `graph` now surfaces frontmatter `references` as labeled edges (dashed in dot output) and warns when a dependency-implying reference is not reflected in config `requires` (#8)
  - `pack` relevance: a task that names a spec's id verbatim always ranks it at 1.0, and high-relevance specs are trimmed into the remaining budget (with omission markers) instead of silently excluded (#9)
  - `ready` reports vacuous checks as "skipped" (e.g. story coverage with no PRD) rather than showing them as passes (#10)

## 0.4.0-alpha.5

### Patch Changes

- 7591c43: `generate story` now truncates long filenames on a word boundary instead of cutting mid-word (`...-rules-across.md` rather than `...-rules-across-st.md`).

## 0.4.0-alpha.4

### Minor Changes

- d246c79: Focus specdx on its core identity: the context engine for spec-driven development.
  - `check`, `check --ai`, `update --from-code`, `generate test-plan`, and `migrate` are now flagged `[experimental]` in CLI help — they remain fully functional but are not part of the stable surface
  - README rewritten around the core loop: validate → lint → pack → keep fresh
  - `status`, `ready`, `explain`, `diff`, and `changelog` now print a friendly error instead of a stack trace when no `spec.config.yaml` exists
  - MCP server: per-tool test coverage for all 7 tools and corrected server version

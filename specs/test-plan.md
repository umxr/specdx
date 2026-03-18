---
id: "tp-001"
type: "test-plan"
title: "sdx — Test Plan"
status: "draft"
version: "1.0"
created: "2026-02-01"
authors: ["umar"]
tags: ["sdx", "testing", "vitest"]
references:
  - id: "tech-001"
    relationship: "depends-on"
---

# sdx — Test Plan

## Scope

This test plan covers the `@sdx/schema`, `@sdx/core`, `@sdx/lint`, and `@sdx/cli` packages that
form the Phase 1 foundation. Phase 2 packages (`@sdx/pack`, `@sdx/diff`) will be covered in a
separate test plan addendum when those packages reach implementation.

The testing approach is:

- **Unit tests** using Vitest for all individual functions, validators, rules, and utilities.
- **Fixture-based integration tests** that run the full lint pipeline against known-good and
  known-bad spec suites stored in `packages/*/src/__fixtures__/`.
- **CLI smoke tests** that invoke `sdx lint`, `sdx validate`, and `sdx graph` against the
  repository's own spec suite and assert correct exit codes and output shapes.

Coverage targets: >80% line coverage on `@sdx/core` and `@sdx/lint`. Schema and CLI packages
are covered primarily through fixture and integration tests.

## Test Cases

### TC-SCH-001: Base spec schema validates required fields

**Given** a spec object missing a required field (e.g. `id`, `type`, `title`, `status`,
`version`, `created`, or `authors`).
**When** `validateSpec` is called.
**Then** it returns `valid: false` with a descriptive error identifying the missing field.

### TC-SCH-002: Base spec schema accepts all valid status values

**Given** a spec object with status set to each of `draft`, `review`, `approved`, `superseded`.
**When** `validateSpec` is called.
**Then** it returns `valid: true` for each value.

### TC-SCH-003: Base spec schema rejects unknown status values

**Given** a spec object with `status: "wip"`.
**When** `validateSpec` is called.
**Then** it returns `valid: false` with an enum constraint error.

### TC-SCH-004: Config schema validates a minimal valid config

**Given** a config with `version: "1.0"` and at least one spec entry.
**When** `validateConfig` is called.
**Then** it returns `valid: true`.

### TC-SCH-005: Config schema rejects unknown top-level keys

**Given** a config with an unrecognised key at the root level.
**When** `validateConfig` is called.
**Then** it returns `valid: false`.

### TC-CORE-001: Config loader finds spec.config.yaml by walking up the directory tree

**Given** a working directory nested several levels below the directory containing
`spec.config.yaml`.
**When** `loadConfig()` is called without an explicit path.
**Then** it locates and loads the correct config file.

### TC-CORE-002: Config loader throws a descriptive error for invalid YAML

**Given** a `spec.config.yaml` containing malformed YAML.
**When** `loadConfig()` is called.
**Then** it throws a `ConfigError` with a message referencing the file path and the parse error.

### TC-CORE-003: Spec parser extracts frontmatter and section headings

**Given** a markdown spec file with valid frontmatter and multiple `##` section headings.
**When** `parseSpec(filePath)` is called.
**Then** the returned `ParsedSpec` has `frontmatter` matching the YAML block and `sections`
containing each heading text.

### TC-CORE-004: Glob resolver returns all matching files

**Given** a spec config entry with path `specs/stories/*.md` and three matching files.
**When** `resolveGlob(pattern, cwd)` is called.
**Then** it returns an array with all three file paths.

### TC-CORE-005: Graph builder detects circular dependencies

**Given** a config where spec A requires B and spec B requires A.
**When** `buildGraph(config)` is called.
**Then** it throws an error identifying the cycle.

### TC-LINT-001: required-sections rule reports missing sections

**Given** a PRD spec missing the "Non-Goals" section.
**When** the lint engine runs with `structure/required-sections` rule.
**Then** a diagnostic with severity `error` identifies the missing section.

### TC-LINT-002: required-sections rule passes when all sections present

**Given** a PRD spec with all five required sections.
**When** the lint engine runs.
**Then** no `structure/required-sections` diagnostics are produced.

### TC-LINT-003: valid-frontmatter rule catches missing required fields

**Given** a spec with frontmatter missing the `id` field.
**When** the lint engine runs with `structure/valid-frontmatter` rule.
**Then** a diagnostic identifies the missing field.

### TC-LINT-004: valid-references rule catches broken cross-references

**Given** a spec with a reference to an ID that does not exist in the suite.
**When** the lint engine runs with `structure/valid-references` rule.
**Then** a diagnostic names the broken reference.

### TC-LINT-005: no-vague-language rule flags known patterns

**Given** a spec body containing a phrase from the configured vague-language list (for example,
a phrase commonly used as a placeholder when the author has not determined the specifics).
**When** the lint engine runs with `clarity/no-vague-language` rule.
**Then** a diagnostic flags the vague phrase.

### TC-LINT-006: strict preset escalates all rules to error severity

**Given** a spec suite with a staleness warning.
**When** the lint engine runs with the `strict` preset.
**Then** the diagnostic has severity `error`, not `warn`.

### TC-CLI-001: sdx validate exits 0 for the project's own spec.config.yaml

**Given** the repository root containing a valid `spec.config.yaml`.
**When** `sdx validate` is run from the repository root.
**Then** exit code is 0 and output confirms the config is valid.

### TC-CLI-002: sdx lint exits 0 on the project's own spec suite

**Given** the repository's own `specs/` directory with well-formed specs.
**When** `sdx lint` is run.
**Then** exit code is 0 and no error diagnostics are reported.

### TC-CLI-003: sdx lint exits 1 when a spec has errors

**Given** a spec suite containing a spec with a missing required section.
**When** `sdx lint` is run.
**Then** exit code is 1 and the diagnostic names the missing section.

### TC-CLI-004: sdx graph outputs the dependency tree

**Given** a spec suite with declared `requires` relationships.
**When** `sdx graph` is run.
**Then** stdout contains a representation of the dependency relationships.

## Coverage Matrix

| Package | Unit Tests | Integration Tests | CLI Smoke Tests |
|---|---|---|---|
| `@sdx/schema` | validators, type exports | fixture-based schema validation | — |
| `@sdx/core` | config loader, spec parser, graph builder, glob resolver | multi-spec suite parsing | — |
| `@sdx/lint` | each rule individually, preset resolution | full lint run on fixture suites | — |
| `@sdx/cli` | formatter functions | — | validate, lint, graph commands |

Target line coverage per package:

| Package | Target |
|---|---|
| `@sdx/schema` | >70% |
| `@sdx/core` | >80% |
| `@sdx/lint` | >80% |
| `@sdx/cli` | >60% |

## Edge Cases

### EC-001: Empty spec suite

A `spec.config.yaml` that defines spec entries whose glob paths match no files. The lint command
should exit 0 with a message indicating no specs were found, rather than crashing.

### EC-002: Spec with no markdown body

A spec file that has valid frontmatter but an empty body. The `required-sections` rule should
report all required sections as missing. The `no-vague-language` rule should return no diagnostics
(no content to scan).

### EC-003: Spec with frontmatter only (no `---` closing delimiter)

A malformed spec file where the frontmatter opening `---` is present but the closing delimiter
is absent. The parser should return a graceful error rather than hanging or crashing.

### EC-004: Dates parsed as Date objects by gray-matter

When `gray-matter` parses an unquoted date in frontmatter (e.g. `created: 2026-01-15`), it may
return a JavaScript `Date` object rather than a string. The validator and all rules that inspect
dates must handle both `string` and `Date` inputs without throwing.

### EC-005: Circular dependencies with more than two nodes

A dependency cycle involving three or more specs (A → B → C → A). The graph builder should
detect and report the full cycle, not stop at the first repeated node.

### EC-006: Glob patterns with no matches

A spec entry with a glob path like `specs/stories/*.md` when the `stories/` directory does not
exist. The glob resolver should return an empty array without throwing a filesystem error.

### EC-007: Duplicate spec IDs across files

Two spec files in the suite that share the same `id` frontmatter value. The `valid-references`
rule should not silently accept this; a future rule (`structure/unique-ids`) should flag it.
This is documented as a known limitation for Phase 1.

### EC-008: Unicode and emoji in spec content

Spec bodies containing Unicode characters, right-to-left text, or emoji. The section heading
extractor, vague-language scanner, and token counter should all handle multi-byte character
sequences without corrupted output or incorrect counts.

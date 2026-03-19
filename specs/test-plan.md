---
id: test-plan
type: test-plan
title: "Test Plan — sdx"
status: approved
version: "1.0"
created: "2026-03-17"
updated: "2026-03-19"
authors: ["umar"]
tags: ["testing", "vitest", "coverage"]
references:
  - id: "technical-design"
    relationship: "depends-on"
---

## Scope

All 8 packages in the monorepo. Tests are co-located with source (`src/foo.test.ts`). Vitest with globals enabled. Coverage threshold: 80% across all packages.

## Test Cases

### @specdx/schema
- JSON Schema validation for all 6 spec types (valid and invalid fixtures)
- Config schema validation (valid configs, missing required fields, invalid values)
- TypeScript type exports compile correctly

### @specdx/core
- Config loader: finds config, handles missing config, validates structure
- Spec parser: parses markdown frontmatter, extracts H2 sections, counts tokens per section
- parseSpecFromString: same as parseSpec but from string input (for git integration)
- Dependency graph: builds DAG, topological sort, detects cycles, getDownstream/getUpstream
- Glob resolver: handles nested patterns, returns empty array for no matches
- Token counter: within 5% of actual tokenisation

### @specdx/lint
- Engine: loads rules, runs against specs, collects diagnostics with correct severity
- Each of 7 rules: positive case (passes), negative case (catches issue)
- Presets: minimal, recommended, strict return correct rule sets
- Custom rule loading: loads ESM rule from file path

### @specdx/pack
- Resolver: keyword matching scores specs correctly, graph propagation boosts neighbours
- Allocator: respects token budget, higher relevance gets more tokens
- Compressor: strips boilerplate, collapses resolved ADRs, summarises stable sections
- Formatters: XML, Markdown, JSON all produce valid output
- End-to-end: pack with task returns relevant subset within budget

### @specdx/diff (Phase 3)
- diffSpecs: identical specs (empty diff), modified frontmatter, added/removed/modified sections
- analyzeImpact: single and transitive downstream, staleness scoring formula
- checkCrossReferences: detects broken refs from removed/renamed spec IDs
- diffBetweenRefs: git integration with temp repo, added/removed/modified specs, error cases
- DiffError: thrown for missing git, bad ref, no history

### @specdx/skills
- installSkills: creates files in .claude/commands/, reports installed/updated, overwrites modified

### specdx (CLI)
- init: scaffolds all 3 templates correctly
- lint: runs rules, correct exit codes
- pack: produces output within budget, respects format flag

## Coverage Matrix

| Package | Target | Current |
|---------|--------|---------|
| schema | 80% | 95%+ |
| core | 80% | 90%+ |
| lint | 80% | 90%+ |
| pack | 80% | 85%+ |
| diff | 80% | 0% (Phase 3, not yet implemented) |
| skills | 80% | 90%+ |
| cli | 80% | 80%+ |

## Edge Cases

- Specs with no sections (frontmatter only)
- Empty spec suite (no specs defined in config)
- Circular dependencies in spec requires
- Specs with unicode content and special characters in headings
- Very large specs exceeding token budget
- Git repos with no commits, detached HEAD, or missing refs
- Config with unknown keys (should pass through, not error)
- Concurrent glob resolution with overlapping patterns

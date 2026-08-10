---
"specdx": patch
---

docs: restructure the README around a quick start, and fix what was wrong

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

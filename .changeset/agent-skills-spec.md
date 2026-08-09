---
"specdx": minor
---

feat(skills): conform to the Agent Skills specification

Skills shipped as flat markdown files installed to `.claude/commands/`, which made them slash commands rather than skills. They now follow [agentskills.io/specification](https://agentskills.io/specification):

- Each skill is a directory containing `SKILL.md`, with `name` matching the directory.
- Bundled resources move to `references/` — the `specdx-author-spec` step files and the shared spec-type reference.
- `allowed-tools` is a space-separated string, not comma-separated, and uses Claude Code prefix syntax (`Bash(npx specdx:*)`).
- `specdx skills install` writes to `.claude/skills/<name>/SKILL.md` and copies bundled resources.
- The Claude Code plugin manifest declares `skills` instead of `commands`, and drops a hand-maintained `version` that had drifted 13 releases behind.

**Breaking:** skills previously installed under `.claude/commands/` are not removed. Delete the old `specdx-*.md` files there after upgrading.

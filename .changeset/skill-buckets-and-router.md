---
"specdx": minor
---

feat(skills): promote by folder, add a router, and state what success looks like

Skills now live in bucket folders where the bucket *is* the promotion: `core/` is what the Claude Code plugin ships and what `specdx skills install` writes; `experimental/` holds the two skills built on `sdx check` and installs only with `--experimental`. Promotion was previously an `[experimental]` string in a description — the same mechanism that let `explain` and `changelog` drift into the core CLI surface.

New `specdx-router` skill (user-invoked) maps the workflows and the distinctions that are easy to get wrong. Every skill now ends with an **"It's working if"** section — a falsifiable success signal, so a skill can be judged to have failed.

**Fixed:** `turbo.json` did not list skill markdown as a build input, so editing a skill did not invalidate the CLI build cache and could ship stale (#30).

`scripts/link-skills.sh` symlinks source skills into `~/.claude/skills` for dogfooding without a rebuild.

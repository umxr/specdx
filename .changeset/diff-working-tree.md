---
"specdx": minor
---

feat(diff): add `--working` and stop reporting a false all-clear on uncommitted specs

`diff` compares committed refs, so uncommitted spec edits were invisible — and reported as "✓ No spec changes detected". `specdx-pre-commit` turned that into "safe to commit" at the one moment the check exists to prevent drift.

Two changes:

- `diff` now lists spec files changed in the working tree that the compared refs do not cover, so the green is never unqualified. Exit code is unchanged.
- New `--working` flag (and `working` on the MCP `sdx_diff` tool) compares the base ref against the working tree, including staged, unstaged, and untracked spec files.

The `specdx-pre-commit` and `specdx-check-drift` skills now use `--working`.

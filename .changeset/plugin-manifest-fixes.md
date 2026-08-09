---
"specdx": patch
---

fix(plugin): repair the hooks manifest and keep plugin versions in sync

`claude plugin validate --strict` failed: `hooks.json` used an array where the schema expects a record keyed by event name, and `plugin.json` never referenced it — so the `SessionStart` hook never loaded for plugin users. The hook path now uses `${CLAUDE_PLUGIN_ROOT}`.

Plugin manifest versions were hand-maintained and had drifted: the Claude manifest carried none and the Cursor manifest was 13 releases behind. `scripts/sync-plugin-version.mjs` now stamps them during `changeset version`, and `pnpm check-plugin-version` guards it in CI.

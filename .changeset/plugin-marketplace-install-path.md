---
"specdx": minor
---

Give the Claude Code plugin an install path

specdx is a Claude Code plugin, and the only documented way to get it was
`npm install -D specdx`. There was no `.claude-plugin/marketplace.json`, so the
command people actually use did not work, and the tool was invisible in the one
channel built for its audience:

```bash
/plugin marketplace add umxr/specdx
/plugin install specdx@specdx
```

Adding the manifest surfaced a defect that had already shipped. `plugin.json`
pointed skills at `./dist/skills/core`, and `dist/` is gitignored — so a
marketplace install, which clones source, would have installed a plugin with
**zero skills**. Confirmed against a clean clone:

```
✘ skills[0]: Path not found: ./dist/skills/core.
  The runtime loader will report this as a load failure.
```

The npm channel was always healthy; only the git channel was broken, which is
the mirror image of #24 and #29 — both of which existed only in the packaged
artifact. Every distribution channel has to be verified from its own artifact.

The manifest cannot name a path outside the plugin root (`../skills/skills/core`
is rejected as path traversal), and the root has to stay `packages/cli` because
`hooks.json` resolves `${CLAUDE_PLUGIN_ROOT}/hooks`. So `packages/cli/skills` is
now a committed copy, generated from the authored tree by
`scripts/sync-plugin-skills.mjs` and regenerated on every build.

A second copy that nothing checks is how two sources of truth silently disagree,
so `@specdx/skills` conformance fails when the trees differ by one file or one
byte, and packaging asserts the manifest never again names a path under `dist/`.
Each new guard was confirmed to fail on a planted violation before being
trusted.

The marketplace entry carries no version: `plugin.json` already holds the
authoritative one and `sync-plugin-version.mjs` stamps it, so duplicating it
here would be one more thing to drift.

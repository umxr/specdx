---
"specdx": minor
---

fix: repair every defect found by the pre-stable audit

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

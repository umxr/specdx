---
"specdx": patch
"@specdx/mcp": patch
---

fix: carry the G2 repair into `sdx_status`, and pin the two implementations to each other

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

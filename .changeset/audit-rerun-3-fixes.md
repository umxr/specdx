---
"specdx": minor
---

fix: repair every defect found by the third pre-stable audit

Six defects, found by driving the published `0.4.0-alpha.19` tarball through seven sandbox projects, an MCP stdio client and the GitHub Action under `act`. The first had never worked in any release.

**`lint --preset strict` was a complete no-op.** `getPreset("strict")` rewrote each rule's `severity`, and the engine never read it — it collected whatever diagnostic objects the rules returned, and ten of the thirteen rules hardcoded `severity: "warn"` in the diagnostic they emitted. `strict` therefore produced output byte-identical to `recommended` on the CLI, in `extends:`, in the Action's `preset` input and in `runLint({ preset })`, so a CI gate written against it never failed. The engine now stamps the rule's declared severity onto the diagnostics that rule returned. The preset test asserted on `rule.severity` — the field nothing consumed — and now asserts on emitted diagnostics and on `hasErrors`.

**`check` threw a stack trace when a test plan met a missing `ts-morph`.** Route and type extraction degraded to a note; test extraction was called unguarded, so one test-plan spec turned the intended skip into an unhandled error — on exactly the ephemeral-runner path the note describes, and through MCP's `sdx_check`, where the bare exception became the tool's only output. All three categories are guarded now, and the note names all three.

**The Prisma extractor could not see a Prisma project's schema.** It read `<root>/schema.prisma` only, and `prisma init` writes `prisma/schema.prisma`. Every model was reported unimplemented and the coverage score dropped to match, with nothing said. It now reads `prisma/schema.prisma`, the project root, and the multi-file `prisma/schema/` directory, and `check` notes when a Prisma dependency is declared but no schema was found. The same shape is fixed for Next.js: `extractNextjsRoutes` defaulted to `app` alone, so `src/app` projects scanned an absent directory and reported no routes.

**Story coverage reported a green check over a feature with no story.** A feature counted as covered at 34 % word overlap, so "Export the payroll report as PDF" was satisfied by a story about the invoice report. `lint` said nothing, `ready` asserted "All PRD features have corresponding stories", and `generate story` refused to stub the missing one — one loose threshold, three wrong answers. A story must now also pick up more than half of the words that set a feature apart from its siblings; where nothing distinguishes them, or nothing is shared, the threshold decides alone as before.

**A type declared as a markdown table was dropped in silence.** The "no fields recognised" note fires per spec, so one readable type hid every unreadable one beside it. Tables are now read as fields when the header names a field column and a type column, and a type whose table still cannot be read is named in its own note. A heading with no field declarations at all remains prose, deliberately.

**A test suggestion carried the spec's own markup.** An unmatched case was reported as `Add a test matching: "**TC5**: …"`. The case ID is now lifted into `SpecTestCase.id`, kept on the finding's `expected` so it stays traceable to a line in the test plan, and left out of the test name a user is asked to write.

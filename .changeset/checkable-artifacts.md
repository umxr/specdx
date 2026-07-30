---
"specdx": minor
---

Framework-agnostic checkable artifacts (#15): any spec can now declare the implementation artifacts it requires in an optional `artifacts:` frontmatter field — file paths that must exist and names they must export. `specdx check` verifies them as a new `artifact` finding category, counts them toward the implementation score, and reports them in the scan summary, so projects without a supported framework (Astro, static sites, CLIs, libraries) get real drift checking instead of "coverage not assessed". Export checks use ts-morph and are skipped with a note — never silently passed — when unavailable. Also fixes single-file `lint <path>`, which previously false-errored on cross-references because it hid the rest of the suite from the reference rule; it now lints against the full suite and reports only the target file's diagnostics.

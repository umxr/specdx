---
"specdx": patch
---

fix(diff): resolve spec entries declared by a glob path

`diff` matched changed files against config `path` values by string equality, so a glob entry (`specs/stories/*.md`) matched nothing and every spec behind it was invisible — reported as "no spec changes detected" and omitted from downstream impact. Paths are now matched as patterns, and globs expand against the compared ref rather than the working tree. Spec ids for added and removed files come from their frontmatter instead of the config entry key. Affects CLI `diff`, CLI `changelog`, the MCP `diff` tool, and the GitHub Action.

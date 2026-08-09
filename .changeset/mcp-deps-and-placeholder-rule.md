---
"specdx": patch
---

fix(mcp): ship the MCP server's runtime dependencies

`specdx mcp` failed with `ERR_MODULE_NOT_FOUND` for every npm install. `@modelcontextprotocol/sdk` and `zod` were marked external in the bundle and declared only on the unpublished `@specdx/mcp` package, so nothing supplied them at runtime. They are now dependencies of `specdx`, the import failure reports an actionable message instead of a raw stack trace on the stdio transport, and a packaging test asserts every external is either declared or an allowlisted optional dependency.

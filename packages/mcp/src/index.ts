export { createMcpServer } from "./server.js";

// `sdx_status` duplicates the CLI's `runStatus` rather than calling it — the
// dependency runs cli → mcp, so it cannot be the other way round. Exported so
// the CLI package can hold the two to each other; a fix to one silently
// missing the other is exactly how `lintHealth.passing` shipped wrong on this
// surface after being fixed on the other (audit run 6, G2).
export { handleStatus } from "./tools/status.js";

// `sdx_lint` duplicates the CLI's `runLint` for the same reason, and drifted
// the same way: `--path` matching no spec was a silent pass on both surfaces,
// and MCP additionally filtered the suite before linting rather than filtering
// the diagnostics after. Exported so the CLI can pin the pair.
export { handleLint } from "./tools/lint.js";

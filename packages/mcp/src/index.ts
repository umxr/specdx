export { createMcpServer } from "./server.js";

// `sdx_status` duplicates the CLI's `runStatus` rather than calling it — the
// dependency runs cli → mcp, so it cannot be the other way round. Exported so
// the CLI package can hold the two to each other; a fix to one silently
// missing the other is exactly how `lintHealth.passing` shipped wrong on this
// surface after being fixed on the other (audit run 6, G2).
export { handleStatus } from "./tools/status.js";

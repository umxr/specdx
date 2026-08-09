import { defineCommand } from "citty";
import pkg from "../../../package.json" with { type: "json" };

export default defineCommand({
  meta: { name: "mcp", description: "Start the specdx MCP server (stdio transport)" },
  args: {},
  async run() {
    // The MCP SDK and zod are dependencies of specdx, not bundled into it. A
    // broken or partial install should say so rather than surface a raw
    // ERR_MODULE_NOT_FOUND stack trace on stdout, which is also the transport.
    let mcp: typeof import("@specdx/mcp");
    let stdio: typeof import("@modelcontextprotocol/sdk/server/stdio.js");
    try {
      mcp = await import("@specdx/mcp");
      stdio = await import("@modelcontextprotocol/sdk/server/stdio.js");
    } catch (err) {
      const missing = (err as Error).message.includes("zod") ? "zod" : "@modelcontextprotocol/sdk";
      console.error(
        `\n  ✗ Cannot start the MCP server: ${missing} is not installed.\n` +
          `    It ships as a dependency of specdx, so this usually means a partial install.\n` +
          `    Try reinstalling specdx, or add it directly: npm install ${missing}\n`,
      );
      process.exit(1);
    }

    const server = mcp.createMcpServer(pkg.version);
    await server.connect(new stdio.StdioServerTransport());
  },
});

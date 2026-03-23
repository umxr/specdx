import { defineCommand } from "citty";

export default defineCommand({
  meta: { name: "mcp", description: "Start the specdx MCP server (stdio transport)" },
  args: {},
  async run() {
    const { createMcpServer } = await import("@specdx/mcp");
    const { StdioServerTransport } = await import("@modelcontextprotocol/sdk/server/stdio.js");

    const server = createMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
  },
});

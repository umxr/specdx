import { describe, it, expect } from "vitest";
import { createMcpServer } from "./server.js";

describe("createMcpServer", () => {
  it("creates a server instance", () => {
    const server = createMcpServer();
    expect(server).toBeDefined();
  });
});

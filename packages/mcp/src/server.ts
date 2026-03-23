import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleValidate } from "./tools/validate.js";
import { handleLint } from "./tools/lint.js";
import { handlePack } from "./tools/pack.js";
import { handleStatus } from "./tools/status.js";
import { handleCheck } from "./tools/check.js";
import { handleDiff } from "./tools/diff.js";
import { handleGraph } from "./tools/graph.js";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "specdx",
    version: "0.3.0",
  });

  server.tool(
    "sdx_validate",
    "Validate the spec.config.yaml configuration file",
    { configPath: z.string().optional().describe("Path to config directory") },
    async (params) => ({
      content: [{ type: "text" as const, text: await handleValidate(params) }],
    }),
  );

  server.tool(
    "sdx_lint",
    "Run lint rules against the spec suite",
    {
      preset: z.string().optional().describe("Lint preset: minimal, recommended, strict"),
      specPath: z.string().optional().describe("Lint a specific spec file"),
    },
    async (params) => ({
      content: [{ type: "text" as const, text: await handleLint(params) }],
    }),
  );

  server.tool(
    "sdx_pack",
    "Pack spec context for LLM consumption within a token budget",
    {
      task: z.string().optional().describe("Task description for relevance scoring"),
      format: z.string().optional().describe("Output format: xml, markdown, json"),
      budget: z.number().optional().describe("Token budget (default: 12000)"),
    },
    async (params) => ({
      content: [{ type: "text" as const, text: await handlePack(params) }],
    }),
  );

  server.tool(
    "sdx_status",
    "Get spec suite health overview (lint health, staleness, integrity)",
    {},
    async () => ({
      content: [{ type: "text" as const, text: await handleStatus() }],
    }),
  );

  server.tool(
    "sdx_check",
    "Run spec-to-implementation drift analysis",
    {
      framework: z.string().optional().describe("Framework: express, hono, nextjs"),
      specId: z.string().optional().describe("Check a specific spec by ID"),
    },
    async (params) => ({
      content: [{ type: "text" as const, text: await handleCheck(params) }],
    }),
  );

  server.tool(
    "sdx_diff",
    "Show spec changes and downstream impact between git refs",
    {
      base: z.string().optional().describe("Base git ref (default: main)"),
      head: z.string().optional().describe("Head git ref (default: HEAD)"),
    },
    async (params) => ({
      content: [{ type: "text" as const, text: await handleDiff(params) }],
    }),
  );

  server.tool(
    "sdx_graph",
    "Get the spec dependency graph",
    {
      format: z.string().optional().describe("Output format: json (default) or dot"),
    },
    async (params) => ({
      content: [{ type: "text" as const, text: await handleGraph(params) }],
    }),
  );

  return server;
}

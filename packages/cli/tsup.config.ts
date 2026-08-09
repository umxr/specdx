import { defineConfig } from "tsup";
import { cpSync } from "node:fs";

export default defineConfig([
  {
    entry: { main: "src/main.ts" },
    format: ["esm"],
    target: "node22",
    platform: "node",
    bundle: true,
    sourcemap: true,
    dts: false,
    clean: true,
    noExternal: ["@specdx/schema", "@specdx/core", "@specdx/lint", "@specdx/pack", "@specdx/skills", "@specdx/diff", "@specdx/check", "@specdx/mcp"],
    external: [
      "ajv", "ajv-formats", "gray-matter", "yaml", "unified", "remark-parse",
      "unist-util-visit", "tinyglobby", "js-tiktoken", "consola", "citty", "ts-morph",
      "@anthropic-ai/sdk", "@modelcontextprotocol/sdk", "zod",
    ],
    onSuccess: async () => {
      cpSync("../skills/skills", "./dist/skills", { recursive: true });
      // npm only auto-includes a README from the package directory, and this
      // package's lives at the repo root -- so the published package had none
      // and the npm page rendered empty.
      cpSync("../../README.md", "./README.md");
      cpSync("../../LICENSE", "./LICENSE");
    },
  },
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    target: "node22",
    platform: "node",
    bundle: true,
    sourcemap: true,
    dts: false,
    noExternal: ["@specdx/schema", "@specdx/core", "@specdx/lint", "@specdx/pack", "@specdx/skills", "@specdx/diff", "@specdx/check", "@specdx/mcp"],
    external: [
      "ajv", "ajv-formats", "gray-matter", "yaml", "unified", "remark-parse",
      "unist-util-visit", "tinyglobby", "js-tiktoken", "consola", "citty", "ts-morph",
      "@anthropic-ai/sdk", "@modelcontextprotocol/sdk", "zod",
    ],
  },
]);

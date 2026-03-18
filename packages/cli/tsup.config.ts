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
    noExternal: ["@sdx/schema", "@sdx/core", "@sdx/lint", "@sdx/pack", "@sdx/skills"],
    external: [
      "ajv", "ajv-formats", "gray-matter", "yaml", "unified", "remark-parse",
      "unist-util-visit", "tinyglobby", "js-tiktoken", "consola", "citty",
    ],
    onSuccess: async () => {
      cpSync("../skills/skills", "./dist/skills", { recursive: true });
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
    noExternal: ["@sdx/schema", "@sdx/core", "@sdx/lint", "@sdx/pack", "@sdx/skills"],
    external: [
      "ajv", "ajv-formats", "gray-matter", "yaml", "unified", "remark-parse",
      "unist-util-visit", "tinyglobby", "js-tiktoken", "consola", "citty",
    ],
  },
]);

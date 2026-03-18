import { defineConfig } from "tsup";

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
    noExternal: ["@sdx/schema", "@sdx/core", "@sdx/lint"],
    external: [
      "ajv", "ajv-formats", "gray-matter", "yaml", "unified", "remark-parse",
      "unist-util-visit", "tinyglobby", "js-tiktoken", "consola", "citty",
    ],
  },
  {
    entry: { index: "src/index.ts" },
    format: ["esm"],
    target: "node22",
    platform: "node",
    bundle: true,
    sourcemap: true,
    dts: false,
    noExternal: ["@sdx/schema", "@sdx/core", "@sdx/lint"],
    external: [
      "ajv", "ajv-formats", "gray-matter", "yaml", "unified", "remark-parse",
      "unist-util-visit", "tinyglobby", "js-tiktoken", "consola", "citty",
    ],
  },
]);

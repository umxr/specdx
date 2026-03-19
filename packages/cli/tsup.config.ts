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
    noExternal: ["@specdx/schema", "@specdx/core", "@specdx/lint", "@specdx/pack", "@specdx/skills", "@specdx/diff"],
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
    noExternal: ["@specdx/schema", "@specdx/core", "@specdx/lint", "@specdx/pack", "@specdx/skills", "@specdx/diff"],
    external: [
      "ajv", "ajv-formats", "gray-matter", "yaml", "unified", "remark-parse",
      "unist-util-visit", "tinyglobby", "js-tiktoken", "consola", "citty",
    ],
  },
]);

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
      cpSync("./skills", "./dist/skills", { recursive: true });
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
    // package.json points `exports["."].types` at ./dist/index.d.ts. Leaving
    // this false published that path with no file behind it, so importing
    // `specdx` from TypeScript failed with TS7016 and sent people looking for
    // an `@types/specdx` that does not exist.
    // package.json points `exports["."].types` here. Left off, that path was
    // published with no file behind it, so importing `specdx` from TypeScript
    // failed with TS7016. It must be tsup's rollup rather than plain `tsc`:
    // the @specdx/* packages are bundled, not published, so a declaration that
    // imports from them is unresolvable for anyone installing this package.
    // `resolve` inlines the @specdx/* declarations. Without it tsup emits
    // `import { LintResults } from "@specdx/lint"` -- a package that is bundled
    // into this one and never published, so every consumer gets TS2307.
    // `paths` points the declaration build at the internal packages' own
    // .d.ts files so rollup-plugin-dts inlines them. Without it the emitted
    // declaration keeps `import { LintResults } from "@specdx/lint"` -- a
    // package bundled into this one and never published, so consumers lose
    // every inherited member of the public types.
    dts: {
      resolve: true,
      compilerOptions: {
        paths: {
          "@specdx/schema": ["../schema/dist/index.d.ts"],
          "@specdx/core": ["../core/dist/index.d.ts"],
          "@specdx/lint": ["../lint/dist/index.d.ts"],
          "@specdx/pack": ["../pack/dist/index.d.ts"],
          "@specdx/diff": ["../diff/dist/index.d.ts"],
          "@specdx/check": ["../check/dist/index.d.ts"],
        },
      },
    },
    noExternal: ["@specdx/schema", "@specdx/core", "@specdx/lint", "@specdx/pack", "@specdx/skills", "@specdx/diff", "@specdx/check", "@specdx/mcp"],
    external: [
      "ajv", "ajv-formats", "gray-matter", "yaml", "unified", "remark-parse",
      "unist-util-visit", "tinyglobby", "js-tiktoken", "consola", "citty", "ts-morph",
      "@anthropic-ai/sdk", "@modelcontextprotocol/sdk", "zod",
    ],
  },
]);

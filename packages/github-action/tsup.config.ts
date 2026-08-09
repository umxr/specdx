import { defineConfig } from "tsup";

/**
 * The action is bundled, not merely compiled.
 *
 * GitHub checks out the repository at a ref and runs the entrypoint with
 * `node` -- there is no install step and no `node_modules`. `tsc` output keeps
 * bare specifiers like `@actions/core` and `@specdx/lint`, which cannot resolve
 * there, so the action could never have run. Everything is inlined here, and
 * the result is committed so a git ref is enough to execute it.
 */
export default defineConfig({
  entry: { main: "src/main.ts" },
  outDir: "bundle",
  // CJS, not ESM: `@actions/core` is CommonJS and calls `require("os")` at load
  // time, which an ESM bundle cannot satisfy ("Dynamic require of \"os\" is not
  // supported"). Actions are conventionally CJS for exactly this reason.
  format: ["cjs"],
  target: "node20",
  platform: "node",
  bundle: true,
  noExternal: [/.*/],
  sourcemap: false,
  dts: false,
  clean: true,
  treeshake: true,
  // One file, so a git ref is enough -- sibling chunks would have to be
  // committed in lockstep to stay runnable.
  splitting: false,
});

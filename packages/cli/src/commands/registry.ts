import type { SubCommandsDef } from "citty";
import initCommand from "./init.js";

/**
 * Every command the CLI registers, in help order.
 *
 * Declared as data rather than read back off `main`, so the surface can be
 * asserted without executing the CLI.
 */
export const COMMAND_NAMES = [
  "init",
  "lint",
  "validate",
  "graph",
  "skills",
  "pack",
  "diff",
  "status",
  "check",
  "ready",
  "update",
  "generate",
  "migrate",
  "mcp",
] as const;

export type CommandName = (typeof COMMAND_NAMES)[number];

/**
 * The `subCommands` map citty registers, keyed by the names above.
 *
 * Typed as citty's own `SubCommandsDef` rather than a `Record<CommandName, ...>`:
 * `CommandDef` is invariant in its args, so a narrower annotation rejects every
 * command that declares args. The test asserts the keys against `COMMAND_NAMES`.
 */
export const subCommands: SubCommandsDef = {
  init: initCommand,
  lint: () => import("./lint.js").then((m) => m.default),
  validate: () => import("./validate.js").then((m) => m.default),
  graph: () => import("./graph.js").then((m) => m.default),
  skills: () => import("./skills.js").then((m) => m.default),
  pack: () => import("./pack.js").then((m) => m.default),
  diff: () => import("./diff.js").then((m) => m.default),
  status: () => import("./status.js").then((m) => m.default),
  check: () => import("./check.js").then((m) => m.default),
  ready: () => import("./ready.js").then((m) => m.default),
  update: () => import("./update.js").then((m) => m.default),
  generate: () => import("./generate.js").then((m) => m.default),
  migrate: () => import("./migrate.js").then((m) => m.default),
  mcp: () => import("./mcp.js").then((m) => m.default),
};

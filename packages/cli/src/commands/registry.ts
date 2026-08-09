import type { ArgsDef, CommandDef, SubCommandsDef } from "citty";
import initCommand from "./core/init.js";

/**
 * Promoted commands — the set `--help` presents without a caveat.
 *
 * Promotion is the directory a command lives in, not an adjective someone
 * remembered to type into its description. `explain` and `changelog` both
 * drifted into the core surface precisely because the marker was a string.
 * Sub-commands are spelled the way a user types them.
 */
export const CORE_COMMANDS = [
  "init",
  "lint",
  "validate",
  "graph",
  "skills",
  "pack",
  "diff",
  "status",
  "ready",
  "generate",
  "generate story",
  "mcp",
] as const;

/** Commands whose output is not yet trusted enough to promote. */
export const EXPERIMENTAL_COMMANDS = ["check", "update", "migrate", "generate test-plan"] as const;

/** Every command that ships, promoted or not. */
export const COMMAND_NAMES = [...CORE_COMMANDS, ...EXPERIMENTAL_COMMANDS];

export type CommandName = (typeof COMMAND_NAMES)[number];

/** Bucket directory a command lives in, under `commands/`. */
export function bucketOf(name: string): "core" | "experimental" {
  return (EXPERIMENTAL_COMMANDS as readonly string[]).includes(name) ? "experimental" : "core";
}

/** Module path for a command, relative to `commands/`. */
export function moduleOf(name: string): string {
  return `${bucketOf(name)}/${name.replace(/ /g, "-")}.ts`;
}

/**
 * Prefix an experimental command's description with its caveat.
 *
 * Derived from the bucket, so no description in the tree spells `[experimental]`
 * itself and the two can never disagree.
 */
export function labelled<T extends ArgsDef>(name: string, cmd: CommandDef<T>): CommandDef<T> {
  if (bucketOf(name) === "core") return cmd;
  const meta = cmd.meta;
  // citty allows meta to be a function or promise. Ours are all plain objects,
  // and the conformance test asserts every experimental command renders the
  // caveat -- so a command that adopts lazy meta fails loudly rather than
  // shipping unlabelled.
  if (typeof meta !== "object" || meta === null || "then" in meta) return cmd;
  return {
    ...cmd,
    meta: { ...meta, description: `[experimental] ${meta.description ?? ""}`.trim() },
  };
}

/** Lazily load a command module and label it according to its bucket. */
function bucketed<T extends ArgsDef>(
  name: string,
  load: () => Promise<CommandDef<T>>,
): () => Promise<CommandDef<T>> {
  return () => load().then((cmd) => labelled(name, cmd));
}

/**
 * The `subCommands` map citty registers, keyed by the top-level names above.
 *
 * Typed as citty's own `SubCommandsDef` rather than a `Record<CommandName, ...>`:
 * `CommandDef` is invariant in its args, so a narrower annotation rejects every
 * command that declares args. The conformance test asserts the keys instead.
 */
export const subCommands: SubCommandsDef = {
  init: initCommand,
  lint: bucketed("lint", () => import("./core/lint.js").then((m) => m.default)),
  validate: bucketed("validate", () => import("./core/validate.js").then((m) => m.default)),
  graph: bucketed("graph", () => import("./core/graph.js").then((m) => m.default)),
  skills: bucketed("skills", () => import("./core/skills.js").then((m) => m.default)),
  pack: bucketed("pack", () => import("./core/pack.js").then((m) => m.default)),
  diff: bucketed("diff", () => import("./core/diff.js").then((m) => m.default)),
  status: bucketed("status", () => import("./core/status.js").then((m) => m.default)),
  check: bucketed("check", () => import("./experimental/check.js").then((m) => m.default)),
  ready: bucketed("ready", () => import("./core/ready.js").then((m) => m.default)),
  update: bucketed("update", () => import("./experimental/update.js").then((m) => m.default)),
  generate: bucketed("generate", () => import("./core/generate.js").then((m) => m.default)),
  migrate: bucketed("migrate", () => import("./experimental/migrate.js").then((m) => m.default)),
  mcp: bucketed("mcp", () => import("./core/mcp.js").then((m) => m.default)),
};

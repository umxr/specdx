import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { CommandDef, CommandMeta } from "citty";
import {
  COMMAND_NAMES,
  CORE_COMMANDS,
  EXPERIMENTAL_COMMANDS,
  bucketOf,
  moduleOf,
  subCommands,
} from "./registry.js";

const commandsRoot = dirname(fileURLToPath(import.meta.url));

/** Command names a user types at the top level, i.e. excluding sub-commands. */
const TOP_LEVEL = COMMAND_NAMES.filter((n) => !n.includes(" "));

/** Resolve a possibly-lazy citty command to its definition. */
async function resolve(entry: unknown): Promise<CommandDef> {
  const value = typeof entry === "function" ? await (entry as () => unknown)() : entry;
  return value as CommandDef;
}

async function describedAs(cmd: CommandDef): Promise<string> {
  const meta = (typeof cmd.meta === "function" ? await cmd.meta() : await cmd.meta) as CommandMeta;
  return meta?.description ?? "";
}

/**
 * Promotion by folder.
 *
 * A command's bucket is the directory it sits in, and the `[experimental]`
 * caveat is derived from that directory at render time. These assertions keep
 * the two from drifting: `explain` and `changelog` both slid into the core
 * surface while the marker was only a string in a description.
 */
describe("CLI command promotion", () => {
  const buckets = readdirSync(commandsRoot).filter((e) =>
    statSync(join(commandsRoot, e)).isDirectory(),
  );

  it("organises commands into exactly two buckets", () => {
    expect(buckets.sort()).toEqual(["core", "experimental"]);
  });

  it("keeps every command module inside a bucket", () => {
    // The registry and the loose files at the top level are infrastructure,
    // not commands. Everything else must have chosen a bucket.
    const loose = readdirSync(commandsRoot).filter(
      (e) => !statSync(join(commandsRoot, e)).isDirectory(),
    );
    expect(loose.sort()).toEqual(["conformance.test.ts", "registry.ts"]);
  });

  it("places every declared command in the bucket its promotion says", () => {
    for (const name of COMMAND_NAMES) {
      expect(existsSync(join(commandsRoot, moduleOf(name)))).toBe(true);
    }
  });

  it("declares every module on disk as a command", () => {
    // The reverse direction: a module that exists but is not registered is
    // dead surface, and one dropped from the registry but left on disk is the
    // shape `explain` had.
    for (const bucket of buckets) {
      const modules = readdirSync(join(commandsRoot, bucket)).filter(
        (e) => e.endsWith(".ts") && !e.endsWith(".test.ts"),
      );
      const declared = COMMAND_NAMES.filter((n) => bucketOf(n) === bucket).map((n) =>
        moduleOf(n).slice(bucket.length + 1),
      );
      expect(modules.sort()).toEqual(declared.sort());
    }
  });

  it("spells the caveat nowhere in the command tree", () => {
    // The label is derived from the bucket. A description that writes it out
    // by hand is a second source of truth, free to disagree with the folder.
    for (const name of COMMAND_NAMES) {
      const source = readFileSync(join(commandsRoot, moduleOf(name)), "utf-8");
      expect(source).not.toContain("[experimental]");
    }
  });

  it("registers exactly the declared top-level commands", () => {
    expect(Object.keys(subCommands).sort()).toEqual([...TOP_LEVEL].sort());
  });

  it("no longer registers explain", () => {
    // Dropped before 0.4.0 stable. On a fresh scaffold it printed
    // `<!-- placeholder -->` as each spec's description, and `status` plus
    // `pack --full` already cover onboarding. 0.x is the last cheap moment to
    // remove a command: after a stable release it breaks users.
    expect([...COMMAND_NAMES]).not.toContain("explain");
  });

  it.each(EXPERIMENTAL_COMMANDS.filter((n) => !n.includes(" ")))(
    "renders %s with the experimental caveat",
    async (name) => {
      const description = await describedAs(await resolve(subCommands[name]));
      expect(description.startsWith("[experimental] ")).toBe(true);
      expect(description.length).toBeGreaterThan("[experimental] ".length);
    },
  );

  it.each(CORE_COMMANDS.filter((n) => !n.includes(" ")))(
    "renders %s without a caveat",
    async (name) => {
      const description = await describedAs(await resolve(subCommands[name]));
      expect(description).not.toContain("[experimental]");
      expect(description.length).toBeGreaterThan(0);
    },
  );

  it("marks the same commands experimental in the README", () => {
    // The CLI reference is the other place a reader learns what is promoted.
    // Left to hand-maintenance it drifts exactly the way the descriptions did.
    const readme = readFileSync(join(commandsRoot, "..", "..", "..", "..", "README.md"), "utf-8");
    const rows = [...readme.matchAll(/^\| `specdx ([^`]+)` \| (.*)$/gm)];
    expect(rows.length).toBeGreaterThan(0);

    const documented = new Map<string, boolean>();
    for (const [, invocation = "", description = ""] of rows) {
      // Longest match wins, so `generate test-plan` beats `generate`.
      const name = COMMAND_NAMES.filter(
        (n) => invocation === n || invocation.startsWith(`${n} `),
      ).sort((a, b) => b.length - a.length)[0];
      if (!name) continue;
      documented.set(name, documented.get(name) || description.includes("*(experimental)*"));
    }

    expect(documented.size).toBeGreaterThan(0);
    for (const [name, marked] of documented) {
      expect({ name, marked }).toEqual({ name, marked: bucketOf(name) === "experimental" });
    }
  });

  it("labels sub-commands by their own bucket, not their parent's", async () => {
    // `generate` is promoted; `generate test-plan` is not. A bucket that only
    // reached the top level would ship the sub-command unlabelled.
    const generate = await resolve(subCommands.generate);
    const subs = (await resolve(generate.subCommands)) as unknown as Record<string, unknown>;
    expect(await describedAs(await resolve(subs.story))).not.toContain("[experimental]");
    expect(await describedAs(await resolve(subs["test-plan"]))).toContain("[experimental] ");
  });
});

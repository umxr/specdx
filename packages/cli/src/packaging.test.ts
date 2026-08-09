import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Read the `external` arrays out of tsup.config.ts as text.
 *
 * Importing the config would drag a file outside `rootDir` into the TS program,
 * so the list is parsed instead. Regex is adequate here: the arrays are literal
 * string lists, and a parse returning nothing fails the test rather than
 * silently passing.
 */
function externalLists(): string[][] {
  const source = readFileSync(join(pkgRoot, "tsup.config.ts"), "utf-8");
  const blocks = source.match(/external:\s*\[[^\]]*\]/g) ?? [];
  return blocks.map((block) => [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1] as string));
}

/**
 * Dependencies deliberately left undeclared: each is lazily imported behind a
 * try/catch that degrades with an actionable message, so the CLI still works
 * without them. Anything else marked `external` must be a real dependency --
 * tsup will not bundle it, and the published package is the only thing that
 * can supply it.
 */
const OPTIONAL_EXTERNALS = new Set(["ts-morph", "@anthropic-ai/sdk"]);

describe("published package dependencies", () => {
  const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf-8")) as {
    dependencies?: Record<string, string>;
  };
  const declared = new Set(Object.keys(pkg.dependencies ?? {}));

  const lists = externalLists();

  it("finds the external lists it is meant to check", () => {
    expect(lists.length).toBeGreaterThan(0);
    expect(lists.every((l) => l.length > 0)).toBe(true);
  });

  it("declares every non-optional external as a dependency", () => {
    const externals = new Set(lists.flat());
    const missing = [...externals].filter(
      (dep) => !OPTIONAL_EXTERNALS.has(dep) && !declared.has(dep),
    );

    // @specdx/mcp declares @modelcontextprotocol/sdk and zod, but that package
    // is bundled rather than published, so its dependencies never reach a user.
    expect(missing).toEqual([]);
  });

  it("keeps both bundle entries on the same external list", () => {
    const normalized = lists.map((l) => [...l].sort().join(","));
    expect(new Set(normalized).size).toBe(1);
  });
});

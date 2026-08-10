import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { formatArg, sharedArgs, resolveFormat } from "./shared-args.js";

const srcRoot = dirname(fileURLToPath(import.meta.url));
const commandsRoot = join(srcRoot, "commands");

describe("formatArg", () => {
  it("advertises exactly the formats it is given", () => {
    expect(formatArg(["pretty", "json"]).description).toBe("Output format (pretty, json)");
  });

  it("defaults to the first format", () => {
    expect(formatArg(["pretty", "json", "github"]).default).toBe("pretty");
    expect(formatArg(["xml", "markdown"]).default).toBe("xml");
  });

  it("refuses to build an arg with no formats", () => {
    expect(() => formatArg([])).toThrow(/at least one format/);
  });
});

describe("sharedArgs", () => {
  it("describes --quiet by what it actually does", () => {
    // The old text promised "suppress info output" while the flag was inert.
    const { quiet } = sharedArgs(["pretty"]);
    expect(quiet.description).toMatch(/problems still print/);
  });
});

describe("resolveFormat", () => {
  it("accepts a supported format", () => {
    expect(resolveFormat("json", ["pretty", "json"])).toEqual({ ok: true, format: "json" });
  });

  it("falls back to the default when unspecified", () => {
    expect(resolveFormat(undefined, ["pretty", "json"])).toEqual({ ok: true, format: "pretty" });
  });

  it("rejects a format the command does not render, naming the ones it does", () => {
    // The defect: `lint --format bogus` printed pretty output and exited 0, so
    // a CI step asking for a payload got prose and still went green.
    const result = resolveFormat("bogus", ["pretty", "json"]);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected rejection");
    expect(result.message).toContain('unknown --format "bogus"');
    expect(result.message).toContain("pretty, json");
  });

  it("rejects a real format that this particular command does not implement", () => {
    // `check --format github` used to fall through to pretty with no signal.
    expect(resolveFormat("github", ["pretty", "json"]).ok).toBe(false);
  });
});

/**
 * A command may not advertise a format it does not render.
 *
 * `--format` was one blanket arg spread into every command, so `github`
 * appeared in nine help texts and was implemented by two. Each command now
 * declares a FORMATS tuple; this holds that tuple to what the module does with
 * it, the way the promotion test holds a description to its folder.
 */
describe("declared formats are implemented formats", () => {
  const modules: { name: string; source: string }[] = [];
  for (const bucket of readdirSync(commandsRoot).filter((e) =>
    statSync(join(commandsRoot, e)).isDirectory(),
  )) {
    for (const file of readdirSync(join(commandsRoot, bucket))) {
      if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
      modules.push({
        name: `${bucket}/${file}`,
        source: readFileSync(join(commandsRoot, bucket, file), "utf-8"),
      });
    }
  }

  it("finds the command modules", () => {
    expect(modules.length).toBeGreaterThan(5);
  });

  it("never spreads a bare sharedArgs object", () => {
    // `...sharedArgs` (no call) is the old blanket spread coming back.
    for (const { name, source } of modules) {
      expect({ name, spread: /\.\.\.sharedArgs\s*[,}]/.test(source) }).toEqual({
        name,
        spread: false,
      });
    }
  });

  it.each(
    modules
      .map((m) => ({ ...m, formats: /const FORMATS = \[([^\]]+)\]/.exec(m.source)?.[1] }))
      .filter((m): m is { name: string; source: string; formats: string } => Boolean(m.formats)),
  )("$name renders every format it declares", ({ source, formats }) => {
    const declared = [...formats.matchAll(/"([^"]+)"/g)].map(([, f]) => f as string);
    expect(declared.length).toBeGreaterThan(0);

    for (const format of declared) {
      // "pretty" is the fallback branch — it is whatever the command does when
      // no other format matched, so it has no literal to find.
      if (format === "pretty") continue;
      expect({ format, branched: source.includes(`=== "${format}"`) }).toEqual({
        format,
        branched: true,
      });
    }
  });

  it.each(modules.filter((m) => m.source.includes("const FORMATS = [")))(
    "$name rejects an unsupported --format instead of falling through",
    ({ source }) => {
      expect(source).toContain("resolveFormat(args.format, FORMATS)");
    },
  );
});

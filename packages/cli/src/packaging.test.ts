import { describe, it, expect } from "vitest";
import {
  readFileSync,
  writeFileSync,
  cpSync,
  chmodSync,
  mkdirSync,
  readdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { execFileSync, execSync } from "node:child_process";
import { tmpdir } from "node:os";
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

describe("Claude Code plugin manifest", () => {
  const manifest = JSON.parse(
    readFileSync(join(pkgRoot, ".claude-plugin", "plugin.json"), "utf-8"),
  ) as Record<string, unknown>;

  it("declares the bundled skills as skills, not commands", () => {
    // Skills are directories containing SKILL.md; commands are flat markdown
    // files. Declaring the skills directory under `commands` made Claude Code
    // load them as slash commands instead.
    // The promoted bucket only -- the plugin must never ship experimental
    // skills, and pointing at the skills root would ship all of them.
    expect(manifest.skills).toBe("./dist/skills/core");
    expect(manifest.commands).toBeUndefined();
  });

  it("carries a version in step with package.json", () => {
    // Hand-maintained, this silently fell 13 releases behind, and
    // `claude plugin validate --strict` warns when it is absent -- so it is
    // stamped by scripts/sync-plugin-version.mjs during `changeset version`.
    const pkgVersion = (
      JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf-8")) as { version: string }
    ).version;
    expect(manifest.version).toBe(pkgVersion);
  });

  it("points hooks at a manifest keyed by event name", () => {
    // The schema wants a record of event -> matchers. Ours was an array, so
    // `claude plugin validate --strict` failed and the SessionStart hook never
    // loaded for plugin users.
    expect(manifest.hooks).toBe("./hooks/hooks.json");
    const hooks = JSON.parse(readFileSync(join(pkgRoot, "hooks", "hooks.json"), "utf-8")) as {
      hooks: Record<string, unknown>;
    };
    expect(Array.isArray(hooks.hooks)).toBe(false);
    expect(Object.keys(hooks.hooks)).toContain("SessionStart");
  });
});

describe("published artifact", () => {
  // These assert properties of the *packed* package. Both defects they cover
  // were invisible to every other test: the exec bit is stripped at pack time,
  // and the README's absence only shows once npm decides what to include.
  const packed = (() => {
    const out = execFileSync("npm", ["pack", "--dry-run", "--json"], {
      cwd: pkgRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const parsed = JSON.parse(out) as { files: { path: string }[] }[];
    return (parsed[0]?.files ?? []).map((f) => f.path);
  })();

  it("finds the packed file list it is meant to check", () => {
    expect(packed.length).toBeGreaterThan(0);
  });

  it("includes a README, so the npm page is not blank", () => {
    expect(packed.some((p) => /^README\.md$/i.test(p))).toBe(true);
  });

  it("ships the declaration file its exports map points at", () => {
    // `exports["."].types` named ./dist/index.d.ts and nothing was published
    // there, so importing `specdx` from TypeScript failed with TS7016 and
    // recommended an `@types/specdx` that does not exist.
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf-8")) as {
      exports?: Record<string, Record<string, string>>;
    };
    const types = pkg.exports?.["."]?.types;
    expect(types).toBeDefined();

    const packedPath = types!.replace(/^\.\//, "");
    expect(packed).toContain(packedPath);
  });

  it("lists `types` first in the exports map, where TypeScript will reach it", () => {
    // Export conditions resolve in declaration order. With `import` first, the
    // entry point resolved to a .js and the `types` entry was never consulted
    // -- so the declaration could be present and still not be found.
    const pkg = JSON.parse(readFileSync(join(pkgRoot, "package.json"), "utf-8")) as {
      exports?: Record<string, Record<string, string>>;
    };
    expect(Object.keys(pkg.exports?.["."] ?? {})[0]).toBe("types");
  });

  it("publishes a declaration that does not import unpublished packages", () => {
    // The @specdx/* packages are bundled into this one and never published, so
    // a declaration importing from them loses every inherited member for the
    // consumer -- types that resolve but are quietly wrong.
    const dts = readFileSync(join(pkgRoot, "dist", "index.d.ts"), "utf-8");
    expect(dts).not.toMatch(/from ['"]@specdx\//);
  });

  it("invokes the SessionStart hook through an interpreter", () => {
    // npm normalises non-`bin` files to 644 when packing, so a manifest that
    // executes the script directly fails with EACCES for every plugin user.
    const hooks = JSON.parse(readFileSync(join(pkgRoot, "hooks", "hooks.json"), "utf-8")) as {
      hooks: { SessionStart: { hooks: { command: string }[] }[] };
    };
    const command = hooks.hooks.SessionStart[0]!.hooks[0]!.command;
    expect(command.startsWith("bash ")).toBe(true);
  });

  it("runs the SessionStart hook from a non-executable copy", () => {
    // The real proof: strip the exec bit the way npm does, then run it.
    const staged = mkdtempSync(join(tmpdir(), "sdx-hook-"));
    cpSync(join(pkgRoot, "hooks"), join(staged, "hooks"), { recursive: true });
    for (const f of readdirSync(join(staged, "hooks"))) {
      chmodSync(join(staged, "hooks", f), 0o644);
    }

    const hooks = JSON.parse(readFileSync(join(staged, "hooks", "hooks.json"), "utf-8")) as {
      hooks: { SessionStart: { hooks: { command: string }[] }[] };
    };
    const command = hooks.hooks.SessionStart[0]!.hooks[0]!.command.replace(
      /\$\{CLAUDE_PLUGIN_ROOT\}/g,
      staged,
    );

    expect(() =>
      execSync(command, { cwd: staged, stdio: ["ignore", "pipe", "pipe"] }),
    ).not.toThrow();

    rmSync(staged, { recursive: true, force: true });
  });

  it("runs the CLI it ships with, not whatever is named specdx on PATH", () => {
    // Verifying the hook *ran* was never enough: it resolved `specdx` from
    // PATH, so a stale global install answered, and its "config invalid" was
    // injected into the session as fact. Here a decoy on PATH would answer
    // wrongly if it were ever consulted.
    const staged = mkdtempSync(join(tmpdir(), "sdx-hook-path-"));
    cpSync(join(pkgRoot, "hooks"), join(staged, "hooks"), { recursive: true });

    // The plugin's own CLI, stubbed so the test does not depend on a build.
    mkdirSync(join(staged, "dist"), { recursive: true });
    writeFileSync(
      join(staged, "dist", "main.js"),
      "console.log('ANSWERED-BY-PLUGIN-CLI');\n",
      "utf-8",
    );

    // A decoy earlier on PATH, standing in for a stale global install.
    const decoyDir = join(staged, "decoy");
    mkdirSync(decoyDir, { recursive: true });
    const decoy = join(decoyDir, "specdx");
    writeFileSync(decoy, "#!/usr/bin/env bash\necho 'ANSWERED-BY-PATH-DECOY'\n", "utf-8");
    chmodSync(decoy, 0o755);

    // A project for the hook to find.
    const project = join(staged, "project");
    mkdirSync(project, { recursive: true });
    writeFileSync(join(project, "spec.config.yaml"), 'version: "1.0"\n', "utf-8");

    const out = execFileSync("bash", [join(staged, "hooks", "run-hook.cmd"), "session-start"], {
      cwd: project,
      encoding: "utf-8",
      env: {
        ...process.env,
        CLAUDE_PLUGIN_ROOT: staged,
        PATH: `${decoyDir}:${process.env.PATH ?? ""}`,
      },
    });

    expect(out).toContain("ANSWERED-BY-PLUGIN-CLI");
    expect(out).not.toContain("ANSWERED-BY-PATH-DECOY");

    rmSync(staged, { recursive: true, force: true });
  });

  it("bounds the graph it injects into the session", () => {
    // `graph` grows a line per spec and per reference edge. Uncapped, a large
    // suite spends a large part of the context window on a session summary.
    const staged = mkdtempSync(join(tmpdir(), "sdx-hook-cap-"));
    cpSync(join(pkgRoot, "hooks"), join(staged, "hooks"), { recursive: true });

    mkdirSync(join(staged, "dist"), { recursive: true });
    writeFileSync(
      join(staged, "dist", "main.js"),
      // 500 lines of graph output, far past any sane cap.
      "if (process.argv[2] === 'graph') " +
        "for (let i = 0; i < 500; i++) console.log('  spec-' + i);\n",
      "utf-8",
    );

    const project = join(staged, "project");
    mkdirSync(project, { recursive: true });
    writeFileSync(join(project, "spec.config.yaml"), 'version: "1.0"\n', "utf-8");

    const out = execFileSync("bash", [join(staged, "hooks", "run-hook.cmd"), "session-start"], {
      cwd: project,
      encoding: "utf-8",
      env: { ...process.env, CLAUDE_PLUGIN_ROOT: staged },
    });

    const context = (JSON.parse(out) as { hookSpecificOutput: { additionalContext: string } })
      .hookSpecificOutput.additionalContext;

    expect(context).toContain("spec-0");
    expect(context).not.toContain("spec-499");
    expect(context).toMatch(/more line\(s\)/);

    rmSync(staged, { recursive: true, force: true });
  });
});

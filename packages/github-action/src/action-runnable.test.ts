import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { isBuiltin } from "node:module";
import { fileURLToPath } from "node:url";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The action as GitHub actually runs it.
 *
 * GitHub clones the repository at a ref and executes the declared entrypoint
 * with node -- no build, no install, no `node_modules`. Every unit test in this
 * package imported the source through the workspace, so none of them could see
 * that the entrypoint was gitignored and its output kept bare specifiers.
 */
describe("the action runs from a checkout", () => {
  // Parsed with regexes rather than a YAML library: action.yml is a small file
  // with a fixed shape, and this package has no yaml dependency to add for it.
  const manifestSource = readFileSync(join(pkgRoot, "action.yml"), "utf-8");
  const mainPath = /^\s*main:\s*"?([^"\n]+)"?/m.exec(manifestSource)?.[1]?.trim() ?? "";
  const inputNames = (() => {
    const block = /^inputs:\n([\s\S]*?)^\S/m.exec(manifestSource + "\nX")?.[1] ?? "";
    return [...block.matchAll(/^ {2}([A-Za-z][\w-]*):/gm)].map((m) => m[1]!);
  })();
  const entry = join(pkgRoot, mainPath);

  it("declares an entrypoint that exists in the working tree", () => {
    expect(existsSync(entry)).toBe(true);
  });

  it("keeps the entrypoint out of .gitignore", () => {
    // `dist/` is ignored repo-wide, which silently excluded the built action
    // from every commit -- so no ref GitHub could check out contained it.
    let ignored: string;
    try {
      ignored = execFileSync("git", ["check-ignore", "-v", entry], {
        cwd: pkgRoot,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      ignored = "";
    }
    expect(ignored).toBe("");
  });

  it("bundles the dependencies it imports rather than leaving them bare", () => {
    const source = readFileSync(entry, "utf-8");
    const specifiers = [
      ...[...source.matchAll(/^import\s.*?from\s*["']([^"']+)["']/gm)].map((m) => m[1]!),
      ...[...source.matchAll(/\brequire\(["']([^"']+)["']\)/g)].map((m) => m[1]!),
    ];

    // ajv ships a standalone code-generation module whose emitted validators
    // require these paths. We compile at runtime and never reach them -- the
    // act workflow exercises the real validation path end to end. Everything
    // else must be inlined: an unbundled `@actions/core` or `@specdx/lint` is
    // precisely what made the action unrunnable.
    const AJV_STANDALONE = /^(ajv|ajv-formats)\/dist\//;
    const unresolvable = specifiers.filter(
      (spec) =>
        !spec.startsWith("node:") &&
        !isBuiltin(spec) &&
        !spec.startsWith(".") &&
        !AJV_STANDALONE.test(spec),
    );
    expect(unresolvable).toEqual([]);
  });

  it("documents only inputs it reads, and reads the ones it documents", () => {
    const source = readFileSync(join(pkgRoot, "src", "main.ts"), "utf-8");
    const read = new Set([...source.matchAll(/core\.getInput\("([^"]+)"\)/g)].map((m) => m[1]!));
    expect(new Set(inputNames)).toEqual(read);
  });

  it("lints a real project and fails the build on spec errors", () => {
    const dir = mkdtempSync(join(tmpdir(), "sdx-action-"));
    mkdirSync(join(dir, "specs"), { recursive: true });
    writeFileSync(
      join(dir, "spec.config.yaml"),
      'version: "1.0"\nproject:\n  name: "act"\nspecs:\n  prd:\n    path: specs/prd.md\n    type: prd\n',
    );
    // `authors` is missing, so lint must report an error.
    writeFileSync(
      join(dir, "specs", "prd.md"),
      [
        "---",
        'id: "prd"',
        'type: "prd"',
        'title: "P"',
        'status: "draft"',
        'version: "1.0"',
        'created: "2026-01-01"',
        "---",
        "",
        "## Problem Statement",
        "",
        "Real content.",
        "",
      ].join("\n"),
    );

    let stdout: string;
    let failed = false;
    try {
      stdout = execFileSync("node", [entry], {
        cwd: dir,
        encoding: "utf-8",
        env: {
          ...process.env,
          "INPUT_WORKING-DIRECTORY": dir,
          INPUT_PRESET: "recommended",
          GITHUB_WORKSPACE: dir,
        } as NodeJS.ProcessEnv,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (err) {
      failed = true;
      stdout = String((err as { stdout?: Buffer }).stdout ?? "");
    }

    // It must reach real lint output rather than dying on a missing import.
    expect(stdout).not.toContain("ERR_MODULE_NOT_FOUND");
    expect(stdout).toMatch(/error|::error/i);
    expect(failed).toBe(true);

    rmSync(dir, { recursive: true, force: true });
  });
});

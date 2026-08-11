import { describe, it, expect } from "vitest";
import { extractReferences, staleReferencesRule } from "./stale-references.js";
import type { AgentFile, AgentLintContext } from "../types.js";

const file = (content: string): AgentFile => ({
  filePath: "/repo/CLAUDE.md",
  relativePath: "CLAUDE.md",
  content,
  lines: content.split("\n"),
  tokens: 10,
});

const context = (content: string, present: string[] = []): AgentLintContext => ({
  file: file(content),
  configDir: "/repo",
  exists: (path) => present.includes(path),
  maxTokens: 8000,
});

const paths = (content: string) => extractReferences(content.split("\n")).map((r) => r.path);

describe("extractReferences", () => {
  it("finds paths in inline code spans", () => {
    expect(paths("The entry point is `packages/cli/src/main.ts` today.")).toEqual([
      "packages/cli/src/main.ts",
    ]);
  });

  it("finds bare filenames with a known source extension", () => {
    expect(paths("Config lives in `spec.config.yaml`.")).toEqual(["spec.config.yaml"]);
  });

  it("finds relative markdown link targets", () => {
    expect(paths("See [the CI guide](docs/ci.md) for details.")).toEqual(["docs/ci.md"]);
  });

  it("strips a leading ./ so the path resolves from the config dir", () => {
    expect(paths("See [config](./spec.config.yaml).")).toEqual(["spec.config.yaml"]);
  });

  it("reports the 1-indexed line a reference sits on", () => {
    const refs = extractReferences(["intro", "", "see `docs/ci.md`"]);
    expect(refs).toEqual([{ path: "docs/ci.md", line: 3 }]);
  });

  it("deduplicates a path mentioned many times", () => {
    expect(paths("`a/b.ts` and again `a/b.ts` and `a/b.ts`")).toEqual(["a/b.ts"]);
  });

  describe("things that look like paths but are not claims about this repo", () => {
    it.each([
      ["a glob", "Run against `src/**/*.ts` please."],
      ["a URL in a code span", "Fetch `https://example.com/a/b.json`."],
      ["an http link target", "See [docs](https://example.com/docs/ci.md)."],
      ["an npm scope", "Import from `@specdx/core` instead."],
      ["a home-relative path", "It writes to `~/.claude/skills`."],
      ["an absolute path", "It reads `/etc/hosts` at boot."],
      ["an env assignment", "Set `DEBUG=app/server` first."],
      ["an anchor-only link", "Jump to [config](#configuration)."],
      ["prose with spaces", "The `spec config file` is required."],
      ["a plain word", "Run `build` before committing."],
    ])("ignores %s", (_label, line) => {
      expect(paths(line)).toEqual([]);
    });
  });

  describe("fenced code blocks", () => {
    it("ignores paths inside a backtick fence, which are usually illustrative", () => {
      // The fenced path is in a code span. A bare `cat src/your-app.ts` would
      // not be extracted even without fence skipping, so a fixture like that
      // passes whether or not the fence logic works — this test was written
      // that way first and survived deleting the fence check.
      const content = ["Real: `docs/ci.md`", "```bash", "edit `src/your-app.ts`", "```"].join("\n");
      expect(paths(content)).toEqual(["docs/ci.md"]);
    });

    it("ignores inline code spans inside a fence too", () => {
      const content = ["```md", "See `made/up/path.ts` for an example", "```"].join("\n");
      expect(paths(content)).toEqual([]);
    });

    it("ignores tilde fences", () => {
      const content = ["~~~", "`made/up/path.ts`", "~~~", "`docs/ci.md`"].join("\n");
      expect(paths(content)).toEqual(["docs/ci.md"]);
    });

    it("resumes checking after a fence closes", () => {
      const content = ["```", "`skipped/a.ts`", "```", "`checked/b.ts`"].join("\n");
      expect(paths(content)).toEqual(["checked/b.ts"]);
    });

    it("does not let a tilde fence close a backtick fence", () => {
      const content = ["```", "~~~", "`still/inside.ts`"].join("\n");
      expect(paths(content)).toEqual([]);
    });
  });
});

describe("agents/stale-references", () => {
  it("flags a path that does not exist", () => {
    const result = staleReferencesRule.run(context("See `docs/gone.md`.", []));
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0]!.message).toContain("docs/gone.md");
    expect(result.diagnostics[0]!.line).toBe(1);
  });

  it("stays silent about a path that exists", () => {
    const result = staleReferencesRule.run(context("See `docs/ci.md`.", ["docs/ci.md"]));
    expect(result.diagnostics).toEqual([]);
    expect(result.assessed).not.toBe(false);
  });

  it("reports that it assessed nothing when the file names no paths", () => {
    // The vacuous case: no diagnostics, but nothing was checked either. Saying
    // so is the difference between "references verified" and "no references".
    const result = staleReferencesRule.run(context("Write good code. Be kind."));
    expect(result.diagnostics).toEqual([]);
    expect(result.assessed).toBe(false);
    expect(result.notAssessedReason).toContain("names no file paths");
  });

  it("checks every reference, not just the first", () => {
    const result = staleReferencesRule.run(
      context("`a/one.ts` and `a/two.ts` and `a/three.ts`", ["a/two.ts"]),
    );
    expect(result.diagnostics.map((d) => d.message.match(/"([^"]+)"/)![1])).toEqual([
      "a/one.ts",
      "a/three.ts",
    ]);
  });
});

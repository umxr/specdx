import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { REQUIRED_SECTIONS } from "@specdx/schema";
import { AGENT_RULES } from "@specdx/lint";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const read = (...parts: string[]) => readFileSync(join(repoRoot, ...parts), "utf-8");

const readme = read("README.md");
const specFormat = read("docs", "spec-format.md");
const ci = read("docs", "ci.md");
const configuration = read("docs", "configuration.md");

/**
 * The spec-type table is the only place a user learns what a type requires, and
 * it once described `epic`, `quick-spec` and `project-context` as "(flexible)"
 * while the linter hard-failed all three for missing sections. Documentation
 * that contradicts an error-severity rule costs a user their first hour.
 *
 * The table moved from the README into `docs/spec-format.md`; the guard follows
 * it, because a conformance test that points at the old location silently stops
 * asserting anything.
 */
describe("the spec-type table matches the schema", () => {
  const rows = new Map<string, string>();
  for (const [, type, sections] of specFormat.matchAll(/^\|\s*`([a-z-]+)`\s*\|([^|]+)\|/gm)) {
    rows.set(type!, sections!.trim());
  }

  it("finds the table it is meant to check", () => {
    expect(rows.size).toBeGreaterThanOrEqual(Object.keys(REQUIRED_SECTIONS).length);
  });

  it.each(Object.keys(REQUIRED_SECTIONS))("documents %s's required sections", (type) => {
    const documented = rows.get(type);
    expect(documented, `no docs row for spec type "${type}"`).toBeDefined();

    const expected = REQUIRED_SECTIONS[type as keyof typeof REQUIRED_SECTIONS];
    const listed = documented!
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    expect(listed).toEqual(expected);
  });
});

/**
 * Every `uses:` line is copy-pasted into a real workflow, so a wrong path or a
 * ref that does not exist is a broken build for whoever trusts it. It pointed
 * at `umxr/specdx-action`, a repository that does not exist; later it pinned
 * `@v0.4.0`, a tag nothing created.
 */
describe("GitHub Action usage", () => {
  const sources: [string, string][] = [
    ["README.md", readme],
    ["docs/ci.md", ci],
  ];

  it.each(sources)("%s references the action by its real path", (_name, source) => {
    const uses = [...source.matchAll(/^\s*-?\s*uses:\s*(umxr\/\S+)\s*$/gm)].map((m) => m[1]!);
    expect(uses.length).toBeGreaterThan(0);
    for (const line of uses) {
      expect(line).toMatch(/^umxr\/specdx\/packages\/github-action@/);
    }
  });

  it.each(sources)("%s pins a ref the release workflow creates", (_name, source) => {
    // changesets tags `specdx@0.4.0`, and GitHub parses `owner/repo/path@ref`
    // by splitting on the last `@` — so that tag can never be a `uses:` ref.
    // The release workflow pushes `v<major>` and `v<version>` for this reason.
    const refs = [...source.matchAll(/uses:\s*umxr\/specdx\/packages\/github-action@(\S+)/g)].map(
      (m) => m[1]!,
    );
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) expect(ref).toMatch(/^v\d+(\.\d+\.\d+)?$/);
  });

  it("the release workflow actually creates those tags", () => {
    const workflow = read(".github", "workflows", "release.yml");
    expect(workflow).toContain('git tag -f "v$version"');
    expect(workflow).toContain('git tag -f "v${version%%.*}"');
  });

  it("passes only inputs the action declares", () => {
    const actionYml = read("packages", "github-action", "action.yml");
    const declared = new Set([...actionYml.matchAll(/^ {2}([A-Za-z][\w-]*):/gm)].map((m) => m[1]!));

    // Indentation-agnostic: the claim is that every input passed is one the
    // action declares, not that the snippet sits at a fixed depth. A hardcoded
    // four spaces silently matched nothing the moment the example grew a
    // `steps:` level, and a test that matches nothing asserts nothing.
    for (const [name, source] of sources) {
      const withBlock = /with:\n((?:[ \t]+\S[^\n]*\n)+)/.exec(
        source.slice(source.indexOf("github-action@")),
      )?.[1];
      expect(withBlock, `no with: block found in ${name}`).toBeDefined();
      const passed = [...withBlock!.matchAll(/^[ \t]+([A-Za-z][\w-]*):/gm)].map((m) => m[1]!);
      expect(passed.length).toBeGreaterThan(0);
      for (const input of passed) expect(declared, `${name} passes ${input}`).toContain(input);
    }
  });
});

/**
 * Docs that promise a config key nothing reads are how `lint.rules` and
 * `lint.ignore` stayed inert through six audits: both were in the schema, in
 * the README, and accepted by `validate`. Every key documented as configurable
 * must exist in the schema, so the docs cannot drift ahead of it again.
 */
describe("documented config keys exist in the schema", () => {
  const schema = JSON.parse(read("packages", "schema", "src", "schemas", "config.json")) as {
    properties: Record<string, { properties?: Record<string, unknown> }>;
  };

  it.each(["lint", "pack", "diff", "check", "ci", "specs", "project", "agents"])(
    "the schema declares the `%s` section the docs describe",
    (section) => {
      expect(Object.keys(schema.properties)).toContain(section);
    },
  );

  it.each([
    ["lint", "extends"],
    ["lint", "rules"],
    ["lint", "ignore"],
    ["agents", "paths"],
    ["agents", "max_tokens"],
    ["agents", "rules"],
  ])("the schema declares %s.%s", (section, key) => {
    expect(Object.keys(schema.properties[section]?.properties ?? {})).toContain(key);
  });

  it.each(["lint", "agents"])("documents every %s key the schema declares", (section) => {
    // The inverse direction: a key in the schema that no doc mentions is a
    // feature users cannot find, which is how `ignore` went unnoticed.
    for (const key of Object.keys(schema.properties[section]?.properties ?? {})) {
      expect(configuration, `docs/configuration.md never mentions ${section}.${key}`).toContain(
        `\`${key}\``,
      );
    }
  });

  it("documents every agent rule that ships", () => {
    // The same inverse check one level down. An agent rule users cannot
    // discover is a rule they cannot configure or switch off, and the rule ids
    // are the whole configuration surface.
    //
    // Matched as a delimited code span, not a bare substring: `toContain` is
    // satisfied by any longer id that starts with this one, so a renamed
    // `agents/size-budget-v2` in the docs would have passed while the shipped
    // rule went undocumented. Found by breaking this test on purpose.
    for (const rule of AGENT_RULES) {
      expect(configuration, `docs/configuration.md never documents ${rule.id}`).toContain(
        `\`${rule.id}\``,
      );
    }
  });
});

/**
 * The README links out to the reference docs rather than restating them. A
 * broken relative link is a dead end for the reader the split was meant to help.
 */
describe("README links resolve", () => {
  it("every relative markdown link points at a file that exists", () => {
    const links = [...readme.matchAll(/\]\((?!https?:)([^)#]+)(?:#[^)]*)?\)/g)].map((m) => m[1]!);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(() => read(...link.split("/")), `README links to missing ${link}`).not.toThrow();
    }
  });
});

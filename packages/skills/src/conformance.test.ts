import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SKILL_NAMES, CORE_SKILL_NAMES, bucketOf } from "./install.js";

const skillsRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "skills");

/**
 * Conformance with the Agent Skills specification (agentskills.io/specification).
 *
 * These are structural guarantees about what we publish, so they belong in the
 * test suite rather than in review: a skill that drifts out of spec is invisible
 * until an agent fails to load it.
 */
const NAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function frontmatterOf(skillMd: string): Record<string, string> {
  const match = skillMd.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const fields: Record<string, string> = {};
  for (const line of (match[1] ?? "").split("\n")) {
    const kv = line.match(/^([a-zA-Z-]+):\s*(.*)$/);
    if (kv) fields[kv[1] as string] = (kv[2] ?? "").replace(/^["']|["']$/g, "");
  }
  return fields;
}

describe("Agent Skills specification conformance", () => {
  const buckets = readdirSync(skillsRoot).filter((e) =>
    statSync(join(skillsRoot, e)).isDirectory(),
  );
  const dirs = buckets.flatMap((bucket) => readdirSync(join(skillsRoot, bucket)));

  it("organises skills into buckets, with no loose files anywhere", () => {
    expect(buckets.sort()).toEqual(["core", "experimental"]);
    for (const dir of [skillsRoot, ...buckets.map((b) => join(skillsRoot, b))]) {
      expect(readdirSync(dir).filter((e) => !statSync(join(dir, e)).isDirectory())).toEqual([]);
    }
    expect(dirs.sort()).toEqual([...SKILL_NAMES].sort());
  });

  it("places every skill in the bucket its promotion says", () => {
    for (const bucket of buckets) {
      for (const skill of readdirSync(join(skillsRoot, bucket))) {
        expect(bucketOf(skill)).toBe(bucket);
      }
    }
  });

  it("keeps the experimental caveat out of promoted skills", () => {
    // Promotion is the folder. A promoted skill still describing itself as
    // experimental means the two sources of truth have drifted apart.
    for (const skill of CORE_SKILL_NAMES) {
      const body = readFileSync(join(skillsRoot, "core", skill, "SKILL.md"), "utf-8");
      const description = frontmatterOf(body).description ?? "";
      expect(description.toLowerCase()).not.toContain("[experimental");
    }
  });

  describe.each(dirs)("%s", (dir) => {
    const skillPath = join(skillsRoot, bucketOf(dir), dir, "SKILL.md");

    it("contains a SKILL.md", () => {
      expect(() => readFileSync(skillPath, "utf-8")).not.toThrow();
    });

    it("has a name matching its directory and the required pattern", () => {
      const name = frontmatterOf(readFileSync(skillPath, "utf-8")).name;
      expect(name).toBe(dir);
      expect(name).toMatch(NAME_PATTERN);
      expect(name!.length).toBeLessThanOrEqual(64);
    });

    it("has a non-empty description within 1024 characters", () => {
      const description = frontmatterOf(readFileSync(skillPath, "utf-8")).description;
      expect(description).toBeDefined();
      expect(description!.length).toBeGreaterThan(0);
      expect(description!.length).toBeLessThanOrEqual(1024);
    });

    it("declares allowed-tools as a space-separated string, never comma-separated", () => {
      const allowed = frontmatterOf(readFileSync(skillPath, "utf-8"))["allowed-tools"];
      if (allowed === undefined) return;
      expect(allowed).not.toContain(",");
    });

    it("states a falsifiable success signal", () => {
      // Borrowed from mattpocock/skills' docs template: a skill that cannot say
      // what success looks like cannot be judged to have failed.
      expect(readFileSync(skillPath, "utf-8")).toContain("## It's working if");
    });

    it("keeps bundled resources in a conventional directory", () => {
      const entries = readdirSync(join(skillsRoot, bucketOf(dir), dir));
      const unexpected = entries.filter(
        (e) => e !== "SKILL.md" && !["references", "scripts", "assets"].includes(e),
      );
      expect(unexpected).toEqual([]);
    });
  });
});

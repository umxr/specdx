import { basename } from "node:path";
import type { LintRule } from "../types.js";

/**
 * A spec's frontmatter `id` must match the key it is registered under.
 *
 * When they disagree, nothing used to say so. `validate` passed, because the
 * config itself is well-formed and the file exists. `lint` reported dangling
 * references -- but blamed every spec that referenced the id, none of which was
 * at fault. And `graph` listed nodes by config key while drawing edges by
 * frontmatter id, so it rendered a node with no edges beside edges from a node
 * that did not exist.
 *
 * One diagnostic on the spec that actually diverged replaces all of that.
 *
 * A warning rather than an error: both names resolve, in different places --
 * frontmatter `references` match the id, config `requires` match the key -- so
 * a suite that keeps them apart still works. What it cannot do is produce a
 * coherent graph, or a useful message when a reference goes stale.
 */
export const idMatchesConfigKeyRule: LintRule = {
  id: "structure/id-matches-config-key",
  description: "A spec's frontmatter id should match the key it is registered under in the config",
  severity: "warn",
  run(context) {
    const { spec, config } = context;
    if (!config) return [];

    const id = spec.frontmatter.id;
    if (typeof id !== "string" || id.length === 0) return [];

    // Find the entry this file was loaded from. Paths may be globs, so match on
    // the filename the config points at rather than re-resolving every glob.
    const specFile = basename(spec.filePath);
    const candidates = Object.entries(config.specs).filter(([, entry]) => {
      const target = basename(entry.path);
      // A glob entry (`specs/stories/*.md`) claims a directory, not a filename,
      // and cannot be checked this way -- its key names a group, not a spec.
      return !target.includes("*") && target === specFile;
    });

    if (candidates.length !== 1) return [];
    const key = candidates[0]![0];
    if (key === id) return [];

    return [
      {
        ruleId: "structure/id-matches-config-key",
        severity: "warn" as const,
        message:
          `Spec declares id "${id}" but is registered in spec.config.yaml as "${key}". ` +
          `Frontmatter references resolve against "${id}" and config requires against "${key}", ` +
          "so the dependency graph shows them as two things. Rename one so they agree.",
        filePath: spec.filePath,
      },
    ];
  },
};

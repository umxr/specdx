import { readFile } from "node:fs/promises";
import { relative } from "node:path";
import { resolveGlob, countTokens } from "@specdx/core";
import type { AgentFile } from "./types.js";

/**
 * Where agent instruction files live when `agents.paths` does not say.
 *
 * Root-level only. A recursive default would sweep `node_modules` and every
 * vendored copy of someone else's CLAUDE.md, and reporting on a file the user
 * did not write is worse than reporting on nothing.
 */
export const DEFAULT_AGENT_PATHS = ["AGENTS.md", "CLAUDE.md"];

/** Default ceiling for one agent file, in tokens. */
export const DEFAULT_MAX_TOKENS = 8000;

/**
 * Resolve `agents.paths` to files on disk.
 *
 * Returns them sorted by relative path so diagnostics come out in a stable
 * order regardless of glob expansion order — otherwise CI output churns
 * between runs for no reason.
 */
export async function discoverAgentFiles(
  patterns: string[],
  configDir: string,
): Promise<AgentFile[]> {
  const seen = new Set<string>();
  const files: AgentFile[] = [];

  for (const pattern of patterns) {
    for (const filePath of await resolveGlob(pattern, configDir)) {
      // Two patterns can legitimately match the same file (`*.md` and
      // `AGENTS.md`); linting it twice would double every diagnostic.
      if (seen.has(filePath)) continue;
      seen.add(filePath);

      const content = await readFile(filePath, "utf8");
      files.push({
        filePath,
        relativePath: relative(configDir, filePath),
        content,
        lines: content.split("\n"),
        tokens: countTokens(content),
      });
    }
  }

  return files.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

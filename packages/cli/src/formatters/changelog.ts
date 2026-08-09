import type { DiffResult } from "@specdx/diff";

/**
 * Render a diff as a markdown changelog.
 *
 * Formerly the `specdx changelog` command, which ran the same comparison as
 * `diff` and differed only in presentation. It is a format, not a second
 * question, so it lives as `diff --format changelog`.
 */
export function formatChangelog(result: DiffResult, baseRef: string, headRef: string): string {
  const lines: string[] = [];
  lines.push(`## Spec Changes (${baseRef}..${headRef})\n`);

  if (result.diffs.length > 0) {
    lines.push("### Modified");
    for (const diff of result.diffs) {
      const sections = diff.sections.map((s) => s.heading).join(", ");
      const versionChange = diff.frontmatter.find((f) => f.field === "version");
      const versionStr = versionChange
        ? ` (${String(versionChange.before)} → ${String(versionChange.after)})`
        : "";
      lines.push(`- **${diff.specId}**${versionStr} — ${sections || "frontmatter only"}`);
    }
    lines.push("");
  }

  if (result.added.length > 0) {
    lines.push("### Added");
    for (const id of result.added) {
      lines.push(`- **${id}**`);
    }
    lines.push("");
  }

  if (result.removed.length > 0) {
    lines.push("### Removed");
    for (const id of result.removed) {
      lines.push(`- **${id}**`);
    }
    lines.push("");
  }

  const allDownstream = result.impact.flatMap((i) => i.downstream);
  if (allDownstream.length > 0) {
    lines.push("### Downstream Impact");
    for (const d of allDownstream) {
      lines.push(`- ${d.specId} may be stale (${d.reason})`);
    }
    lines.push("");
  }

  if (result.diffs.length === 0 && result.added.length === 0 && result.removed.length === 0) {
    lines.push("No spec changes detected.\n");
  }

  // The uncommitted warning matters most here: a changelog is usually written
  // at release time, when unstaged spec edits are easy to miss.
  if (result.uncommittedSpecFiles.length > 0) {
    lines.push(
      `> ⚠ ${result.uncommittedSpecFiles.length} spec file(s) changed in the working tree are not covered by this range.\n`,
    );
  }

  return lines.join("\n");
}

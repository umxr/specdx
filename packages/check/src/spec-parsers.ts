import type { HttpMethod, SpecEndpoint, SpecTypeDefinition, SpecTestCase } from "./types.js";

/**
 * Extracts the content of a `## Heading` section from a markdown string.
 * Returns the text between that heading and the next `## ` heading (or end of string).
 */
function extractSection(content: string, heading: string): string | null {
  // Match the heading line (case-insensitive, trimmed)
  const headingPattern = new RegExp(`^##\\s+${escapeRegex(heading)}\\s*$`, "im");
  const match = headingPattern.exec(content);
  if (!match) return null;

  const start = match.index + match[0].length;
  const rest = content.slice(start);

  // Find the next `## ` heading
  const nextSection = /^##\s+/m.exec(rest);
  return nextSection ? rest.slice(0, nextSection.index) : rest;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const HTTP_METHODS: ReadonlySet<string> = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

/**
 * Parses the `## Endpoints` section of a spec and returns structured endpoint data.
 */
export function parseEndpoints(content: string): SpecEndpoint[] {
  const section = extractSection(content, "Endpoints");
  if (!section) return [];

  const results: SpecEndpoint[] = [];

  // Split by `### METHOD /path` headings
  const headingPattern = /^###\s+(GET|POST|PUT|PATCH|DELETE)\s+(\S+)/im;
  // Split section into blocks starting at each `### ` heading
  const blocks = section.split(/^(?=###\s)/m);

  for (const block of blocks) {
    const headingMatch = headingPattern.exec(block);
    if (!headingMatch) continue;

    const rawMethod = headingMatch[1]!.toUpperCase();
    if (!HTTP_METHODS.has(rawMethod)) continue;
    const method = rawMethod as HttpMethod;
    const path = headingMatch[2]!;

    // Extract path params: segments starting with `:`
    const params = (path.match(/:([A-Za-z_][A-Za-z0-9_]*)/g) ?? []).map((p) => p.slice(1));

    // Description: first non-empty line after the heading line
    const afterHeading = block.slice(headingMatch.index + headingMatch[0].length);
    const descriptionLine = afterHeading
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith("-"));

    results.push({
      method,
      path,
      params,
      description: descriptionLine,
    });
  }

  return results;
}

/**
 * An identifier, or identifiers joined by `|` / `&` -- what a type annotation
 * looks like, as opposed to a sentence.
 */
const TYPE_SHAPE = /^[A-Za-z_$][\w$.<>[\]]*(?:\s*[|&]\s*[A-Za-z_$][\w$.<>[\]]*)*$/;

/**
 * Parses the `## Data Model` section of a spec and returns structured type definitions.
 */
export function parseTypeDefinitions(content: string): SpecTypeDefinition[] {
  const section = extractSection(content, "Data Model");
  if (!section) return [];

  const results: SpecTypeDefinition[] = [];

  // Split by `### TypeName` headings
  const blocks = section.split(/^(?=###\s)/m);

  for (const block of blocks) {
    const headingMatch = /^###\s+(\S+)/m.exec(block);
    if (!headingMatch) continue;

    const name = headingMatch[1]!;
    const fields: SpecTypeDefinition["fields"] = [];

    // Field lines, backticked or not: `- \`fieldName?\`: type` / `- fieldName?: type`.
    //
    // Requiring backticks meant an ordinary markdown Data Model parsed to zero
    // fields, which `check` then dropped from coverage without saying so. The
    // un-backticked form is deliberately strict -- a single identifier only --
    // so prose like "- Note: this table is partitioned" is not read as a field.
    const fieldPattern = /^-\s+(?:`([^`]+)`|([A-Za-z_$][\w$]*\??))\s*:\s*(.+)/gm;
    let fieldMatch: RegExpExecArray | null;

    while ((fieldMatch = fieldPattern.exec(block)) !== null) {
      const backticked = fieldMatch[1] !== undefined;
      const rawName = (fieldMatch[1] ?? fieldMatch[2])!;
      const optional = rawName.endsWith("?");
      const fieldName = optional ? rawName.slice(0, -1) : rawName;

      // Type is everything before optional parenthetical notes like "(UUID)"
      const rawType = fieldMatch[3]!.trim();
      const type = rawType.replace(/\s*\(.*?\)\s*$/, "").trim();

      // Backticks are the author saying "this is a field", so the type is taken
      // as written. Without them the line is only a field if the type also
      // looks like one -- otherwise "- Note: this table is partitioned by
      // tenant" would become a field named Note.
      if (!backticked && !TYPE_SHAPE.test(type)) continue;

      fields.push({ name: fieldName, type, optional });
    }

    results.push({ name, fields });
  }

  return results;
}

/**
 * Parses the `## Test Cases` section of a spec and returns structured test case data.
 */
export function parseTestCases(content: string): SpecTestCase[] {
  const section = extractSection(content, "Test Cases");
  if (!section) return [];

  const results: SpecTestCase[] = [];
  let currentSection: string | undefined;

  for (const rawLine of section.split("\n")) {
    const line = rawLine.trim();

    // Track `### SubSection` headings
    const subHeading = /^###\s+(.+)/.exec(line);
    if (subHeading) {
      currentSection = subHeading[1]!.trim();
      continue;
    }

    // Bullet points are test cases; each comma-separated item in the text is its own case
    const bulletMatch = /^-\s+(.+)/.exec(line);
    if (!bulletMatch) continue;

    const bulletText = bulletMatch[1]!.trim();

    // Split on `, ` only when it separates items after a label like "label: item1, item2"
    // Pattern: label: item1, item2, item3 → generate one entry per item
    const colonIdx = bulletText.indexOf(":");
    if (colonIdx !== -1) {
      const label = bulletText.slice(0, colonIdx).trim();
      const rest = bulletText.slice(colonIdx + 1).trim();
      const items = rest.split(/,\s*/);
      for (const item of items) {
        const trimmed = item.trim();
        if (trimmed) {
          results.push({ description: `${label}: ${trimmed}`, section: currentSection });
        }
      }
    } else {
      results.push({ description: bulletText, section: currentSection });
    }
  }

  return results;
}

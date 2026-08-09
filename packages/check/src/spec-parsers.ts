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
/** Path params are the `:name` segments of a route path. */
function pathParams(path: string): string[] {
  return (path.match(/:([A-Za-z_][A-Za-z0-9_]*)/g) ?? []).map((p) => p.slice(1));
}

/**
 * True when `content` has an `## Endpoints` heading at all, regardless of what
 * it holds. Lets a caller tell "no such section" from "a section we could not
 * read" -- the second is worth a note, the first is not.
 */
export function hasEndpointsSection(content: string): boolean {
  return extractSection(content, "Endpoints") !== null;
}

/**
 * Parses the `## Endpoints` section of a spec and returns structured endpoint data.
 *
 * Two shapes are accepted, because both are what people write:
 *
 *   ### GET /invoices          (a sub-heading per endpoint, description beneath)
 *   - `GET /invoices` — list   (one bullet per endpoint, backticked or not)
 *
 * Accepting only the heading form meant an ordinary bulleted contract parsed to
 * zero endpoints. `check` then reported every real route as unspecified, missed
 * every genuinely absent one, and raised the coverage score because routes left
 * the denominator entirely.
 */
export function parseEndpoints(content: string): SpecEndpoint[] {
  const section = extractSection(content, "Endpoints");
  if (!section) return [];

  const results: SpecEndpoint[] = [];
  const seen = new Set<string>();

  const push = (rawMethod: string, path: string, description?: string): void => {
    const method = rawMethod.toUpperCase();
    if (!HTTP_METHODS.has(method)) return;
    // A contract listing an endpoint under a heading *and* in a summary bullet
    // describes one endpoint, not two.
    const key = `${method} ${path}`;
    if (seen.has(key)) return;
    seen.add(key);
    results.push({
      method: method as HttpMethod,
      path,
      params: pathParams(path),
      description: description && description.length > 0 ? description : undefined,
    });
  };

  // Shape 1: `### METHOD /path` sub-headings.
  const headingPattern = /^###\s+(GET|POST|PUT|PATCH|DELETE)\s+(\S+)/im;
  for (const block of section.split(/^(?=###\s)/m)) {
    const headingMatch = headingPattern.exec(block);
    if (!headingMatch) continue;

    // Description: first non-empty line after the heading line
    const afterHeading = block.slice(headingMatch.index + headingMatch[0].length);
    const descriptionLine = afterHeading
      .split("\n")
      .map((l) => l.trim())
      .find((l) => l.length > 0 && !l.startsWith("#") && !l.startsWith("-"));

    push(headingMatch[1]!, headingMatch[2]!, descriptionLine);
  }

  // Shape 2: one bullet per endpoint. The method and path may be wrapped in
  // backticks together (`GET /invoices`), separately (`GET` `/invoices`), or
  // not at all, and may carry bold emphasis. Anything after the path -- an
  // em-dash, a colon, a hyphen -- is the description.
  const bulletPattern = new RegExp(
    "^\\s*[-*+]\\s+" + // bullet marker
      "[`*_]*\\s*" + // opening backtick/emphasis
      "(GET|POST|PUT|PATCH|DELETE)" + // method
      "[`*_]*\\s+[`*_]*" + // separator, possibly re-opening a code span
      "(/[^\\s`*_]*)" + // path -- must start at the root, stops at a code span or emphasis
      "[`*_]*" + // closing backtick/emphasis
      "\\s*(?:[—–:-]\\s*(.*))?$", // optional description
    "gim",
  );
  let bulletMatch: RegExpExecArray | null;
  while ((bulletMatch = bulletPattern.exec(section)) !== null) {
    push(bulletMatch[1]!, bulletMatch[2]!, bulletMatch[3]?.trim());
  }

  return results;
}

/**
 * An identifier, or identifiers joined by `|` / `&` -- what a type annotation
 * looks like, as opposed to a sentence.
 */
const TYPE_SHAPE = /^[A-Za-z_$][\w$.<>[\]]*(?:\s*[|&]\s*[A-Za-z_$][\w$.<>[\]]*)*$/;

/**
 * What a `### Heading` inside a Data Model must look like to be a type name:
 * one identifier, optionally generic. Prose headings ("Notes on the model")
 * have spaces and are not type declarations.
 */
const TYPE_NAME_SHAPE = /^[A-Za-z_$][\w$]*(?:<[\w$,\s[\]]+>)?$/;

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
    // The whole heading line, not just its first word: `### Notes on the model`
    // used to register a type called "Notes" that code was then told to
    // implement. A type name is a single identifier-shaped token.
    const headingMatch = /^###\s+(.+?)\s*$/m.exec(block);
    if (!headingMatch) continue;

    const name = headingMatch[1]!.trim().replace(/^`|`$/g, "");
    if (!TYPE_NAME_SHAPE.test(name)) continue;

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

    // A heading with no fields beneath it asserts only that a name exists, and
    // in practice it is prose -- `### Indexes`, `### Migration notes`. Matching
    // it against code turns an explanatory sub-section into a check error, so a
    // block earns its place as a type only by declaring at least one field.
    if (fields.length === 0) continue;

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

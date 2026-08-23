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
 * A bracketed group or quoted literal collapses to this single token, so a type
 * carrying one is still one atom. It is a character no spec contains, so it can
 * never be confused with something the author wrote.
 */
const GROUP = "\u00A7";

/**
 * A type annotation, as opposed to a sentence: identifiers, quoted literals and
 * numbers, joined by `|`, `&` or `=>`, each optionally carrying collapsed groups
 * (`Record<...>`, `Post[]`, `{ ... }`, `() => void`).
 *
 * The shape this replaced allowed only bare identifiers and their `.<>[]`
 * suffixes, so `"light" | "dark"` and `Record<string, number>` — ordinary
 * TypeScript — were read as prose and dropped (issue #51).
 */
const TYPE_ATOM = `(?:[A-Za-z_$][\\w$.]*|-?\\d+(?:\\.\\d+)?|${GROUP})${GROUP}*`;
const TYPE_SHAPE = new RegExp(`^${TYPE_ATOM}(?:\\s*(?:[|&]|=>)\\s*${TYPE_ATOM})*$`);

/** Quoted literals and bracketed groups, innermost first, each reduced to one token. */
function collapseGroups(type: string): string {
  let collapsed = type.replace(/"[^"]*"|'[^']*'|`[^`]*`/g, GROUP);
  let previous = "";
  while (collapsed !== previous) {
    previous = collapsed;
    collapsed = collapsed.replace(/<[^<>]*>|\{[^{}]*\}|\([^()]*\)|\[[^[\]]*\]/g, GROUP);
  }
  return collapsed;
}

/** True when a string reads as a type annotation rather than as prose. */
function looksLikeType(type: string): boolean {
  return type.length > 0 && TYPE_SHAPE.test(collapseGroups(type));
}

/**
 * Index of the first ` — `, ` – ` or ` - ` separating a type from a description,
 * ignoring any inside brackets or quotes; -1 when there is none.
 *
 * `parseEndpoints` has always accepted those three after a path, so a spec that
 * described its endpoints and its fields in the same house style had one read
 * and the other silently dropped (issue #51).
 */
function descriptionStart(raw: string): number {
  let depth = 0;
  let quote: string | null = null;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]!;
    if (quote !== null) {
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "(" || ch === "[" || ch === "{" || ch === "<") {
      depth += 1;
      continue;
    }
    if (ch === ")" || ch === "]" || ch === "}" || ch === ">") {
      depth = Math.max(0, depth - 1);
      continue;
    }
    if (depth > 0 || !/\s/.test(ch)) continue;
    if (/^\s+(?:—|–|-{1,2})\s+/.test(raw.slice(i))) return i;
  }
  return -1;
}

/** The type a field declares, with any description or parenthetical note removed. */
function normaliseFieldType(raw: string): string {
  const cut = descriptionStart(raw);
  const type = (cut === -1 ? raw : raw.slice(0, cut)).trim();

  // A trailing parenthetical is a note about the field ("(UUID)") -- unless
  // removing it leaves nothing, in which case it was the type: `(A | B)`.
  const withoutNote = type.replace(/\s*\(.*?\)\s*$/, "").trim();
  return withoutNote.length > 0 ? withoutNote : type;
}

/**
 * What a `### Heading` inside a Data Model must look like to be a type name:
 * one identifier, optionally generic. Prose headings ("Notes on the model")
 * have spaces and are not type declarations.
 */
const TYPE_NAME_SHAPE = /^[A-Za-z_$][\w$]*(?:<[\w$,\s[\]]+>)?$/;

/**
 * A field declaration line, backticked or not -- `- \`fieldName?\`: type` or
 * `- fieldName?: type` -- under any of the three markdown bullet markers.
 */
const FIELD_LINE = /^[ \t]*[-*+]\s+(?:`([^`]+)`|([A-Za-z_$][\w$]*\??))\s*:\s*(.+)$/;

/**
 * The field a line declares, or null when the line is prose.
 *
 * Requiring backticks meant an ordinary markdown Data Model parsed to zero
 * fields, which `check` then dropped from coverage without saying so. The
 * un-backticked form is deliberately strict -- the type has to look like a type
 * -- so "- Note: this table is partitioned by tenant" is not read as a field.
 * Backticks are the author saying "this is a field", so the type is then taken
 * as written.
 */
function parseFieldLine(line: string): SpecTypeDefinition["fields"][number] | null {
  const match = FIELD_LINE.exec(line);
  if (!match) return null;

  const backticked = match[1] !== undefined;
  const rawName = (match[1] ?? match[2])!;
  const optional = rawName.endsWith("?");
  const type = normaliseFieldType(match[3]!);

  if (type.length === 0) return null;
  if (!backticked && !looksLikeType(type)) return null;

  return { name: optional ? rawName.slice(0, -1) : rawName, type, optional };
}

/** The `### TypeName` a block declares, or null when its heading is prose. */
function typeHeading(block: string): string | null {
  // The whole heading line, not just its first word: `### Notes on the model`
  // used to register a type called "Notes" that code was then told to
  // implement. A type name is a single identifier-shaped token.
  const headingMatch = /^###\s+(.+?)\s*$/m.exec(block);
  if (!headingMatch) return null;

  const name = headingMatch[1]!.trim().replace(/^`|`$/g, "");
  return TYPE_NAME_SHAPE.test(name) ? name : null;
}

/** Every field a `### TypeName` block declares as bullets. */
function parseFieldBullets(block: string): SpecTypeDefinition["fields"] {
  const fields: SpecTypeDefinition["fields"] = [];
  for (const line of block.split("\n")) {
    const field = parseFieldLine(line);
    if (field) fields.push(field);
  }
  return fields;
}

/**
 * Parses the `## Data Model` section of a spec and returns structured type definitions.
 */
export function parseTypeDefinitions(content: string): SpecTypeDefinition[] {
  const section = extractSection(content, "Data Model");
  if (!section) return [];

  const results: SpecTypeDefinition[] = [];

  // Split by `### TypeName` headings
  for (const block of section.split(/^(?=###\s)/m)) {
    const name = typeHeading(block);
    if (name === null) continue;

    const fields = parseFieldBullets(block);

    // A table is the third way people write a data model, and reading only the
    // bullet forms meant a table-shaped type contributed nothing to the score
    // and drew no note -- the note fires per spec, so one readable type hid
    // every unreadable one beside it.
    if (fields.length === 0) fields.push(...parseFieldTable(block));

    // A heading with no fields beneath it asserts only that a name exists, and
    // in practice it is prose -- `### Indexes`, `### Migration notes`. Matching
    // it against code turns an explanatory sub-section into a check error, so a
    // block earns its place as a type only by declaring at least one field.
    if (fields.length === 0) continue;

    results.push({ name, fields });
  }

  return results;
}

/** A markdown table row split into trimmed cells, or null when the line is not one. */
function tableCells(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|")) return null;
  return trimmed
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim().replace(/^`|`$/g, ""));
}

/** True for the `|---|---|` rule under a table's header row. */
function isTableRule(cells: string[]): boolean {
  return cells.every((cell) => /^:?-{2,}:?$/.test(cell));
}

/**
 * Fields from a markdown table inside a `### TypeName` block.
 *
 * Needs a header naming both a field column and a type column; anything else is
 * a table about something other than the shape of the type, and is left alone.
 */
function parseFieldTable(block: string): SpecTypeDefinition["fields"] {
  const rows = block.split("\n").map(tableCells);
  const headerIndex = rows.findIndex((r) => r !== null);
  if (headerIndex === -1) return [];

  const header = rows[headerIndex]!;
  const nameColumn = header.findIndex((h) => /^(field|name|property|attribute|key)s?$/i.test(h));
  const typeColumn = header.findIndex((h) => /^types?$/i.test(h));
  if (nameColumn === -1 || typeColumn === -1) return [];

  const fields: SpecTypeDefinition["fields"] = [];
  for (const cells of rows.slice(headerIndex + 1)) {
    if (cells === null) continue;
    if (isTableRule(cells)) continue;

    const rawName = cells[nameColumn];
    const rawType = cells[typeColumn];
    if (!rawName || !rawType) continue;

    const optional = rawName.endsWith("?");
    const name = optional ? rawName.slice(0, -1) : rawName;
    if (!/^[A-Za-z_$][\w$]*$/.test(name)) continue;

    fields.push({ name, type: normaliseFieldType(rawType), optional });
  }
  return fields;
}

/**
 * Type-shaped `### Heading`s in a Data Model that declared a table we could not
 * read as fields.
 *
 * Prose blocks are deliberately absent: a heading with no field declarations at
 * all is an explanatory sub-section, and re-flagging it would undo the fix that
 * stopped `### Indexes` becoming a phantom type. A table, on the other hand, is
 * an author declaring a shape in a syntax the parser missed — worth saying,
 * because the alternative is dropping it from the score in silence.
 */
export function unreadableTypeBlocks(content: string): string[] {
  const section = extractSection(content, "Data Model");
  if (!section) return [];

  const unreadable: string[] = [];
  for (const block of section.split(/^(?=###\s)/m)) {
    const name = typeHeading(block);
    if (name === null) continue;

    const hasTable = block.split("\n").some((line) => tableCells(line) !== null);
    if (!hasTable) continue;

    const parsed = parseTypeDefinitions(`## Data Model\n\n${block}`);
    if (parsed.length === 0) unreadable.push(name);
  }
  return unreadable;
}

/**
 * Field lines in a Data Model that no type claims, because no `### TypeName`
 * heading stands above them.
 *
 * This is the only unreadable-Data-Model case left worth a word. A Data Model
 * written as prose declares no fields and is not trying to: warning about it
 * once per spec on every run, with no edit short of restructuring valid prose
 * to clear it, taught people to ignore every warning `check` prints (issue
 * #38). A line that does parse as a field but belongs to nothing is different —
 * it is a declaration the author expects to be checked, and it is not being.
 */
export function unattachedFieldLines(content: string): string[] {
  const section = extractSection(content, "Data Model");
  if (!section) return [];

  const unattached: string[] = [];
  for (const block of section.split(/^(?=###\s)/m)) {
    // Fields under a type heading are read; only orphans are of interest.
    if (typeHeading(block) !== null) continue;

    for (const line of block.split("\n")) {
      if (parseFieldLine(line) !== null) unattached.push(line.trim());
    }
  }
  return unattached;
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

    let bulletText = bulletMatch[1]!.trim();

    // A test-case ID names the case in the spec; it is not part of the test a
    // user is being asked to write. Leaving it in produced the suggestion
    // `Add a test matching: "**TC5**: refuses to amend…"`, markup and all, and
    // put `tc5` into the similarity comparison as if it were a word.
    let caseId: string | undefined;
    const idMatch = /^\*{0,2}(TC\d+)\*{0,2}\s*[:.-]\s*/i.exec(bulletText);
    if (idMatch) {
      caseId = idMatch[1]!.toUpperCase();
      bulletText = bulletText.slice(idMatch[0].length).trim();
      if (!bulletText) continue;
    }

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
          results.push({
            description: `${label}: ${trimmed}`,
            section: currentSection,
            id: caseId,
          });
        }
      }
    } else {
      results.push({ description: bulletText, section: currentSection, id: caseId });
    }
  }

  return results;
}

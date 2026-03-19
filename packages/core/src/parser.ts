import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import * as grayMatterNs from "gray-matter";
import { parse as parseYaml } from "yaml";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";
import { validateSpec, type ValidationResult } from "@specdx/schema";
import type { BaseSpec, SpecType } from "@specdx/schema";
import { countTokens } from "./tokens.js";

// gray-matter is CJS — its callable default is exposed via .default in an ESM context
type GrayMatterFn = (input: string) => { data: Record<string, unknown>; content: string };
const matter = ((grayMatterNs as unknown as { default?: GrayMatterFn }).default ??
  (grayMatterNs as unknown as GrayMatterFn)) as GrayMatterFn;

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

export interface ParsedSection {
  heading: string;
  content: string;
  tokens: number;
}

export interface ParsedSpec {
  filePath: string;
  frontmatter: BaseSpec & Record<string, unknown>;
  content: string;
  sections: string[];
  parsedSections: ParsedSection[];
  valid: boolean;
  validationErrors: ValidationResult["errors"];
}

export async function parseSpec(filePath: string): Promise<ParsedSpec> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch {
    throw new ParseError(`Cannot read spec file: ${filePath}`);
  }

  return parseSpecFromString(raw, filePath);
}

export function parseSpecFromString(content: string, filePath: string): Promise<ParsedSpec> {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".yaml" || ext === ".yml") {
    return Promise.resolve(parseYamlSpec(filePath, content));
  }
  return Promise.resolve(parseMarkdownSpec(filePath, content));
}

function parseMarkdownSpec(filePath: string, raw: string): ParsedSpec {
  const { data, content } = matter(raw);
  const parsedSections = extractParsedSections(content);
  const sections = parsedSections.map((s) => s.heading).filter(Boolean);
  const frontmatter = data as BaseSpec & Record<string, unknown>;
  const specType = frontmatter.type as SpecType | undefined;

  let valid = false;
  let validationErrors: ValidationResult["errors"] = null;
  if (specType) {
    const result = validateSpec(specType, data);
    valid = result.valid;
    validationErrors = result.errors;
  }

  return { filePath, frontmatter, content, sections, parsedSections, valid, validationErrors };
}

function parseYamlSpec(filePath: string, raw: string): ParsedSpec {
  let data: Record<string, unknown>;
  try {
    data = parseYaml(raw) as Record<string, unknown>;
  } catch (err) {
    throw new ParseError(`Invalid YAML in ${filePath}: ${(err as Error).message}`);
  }

  const frontmatter = data as BaseSpec & Record<string, unknown>;
  const specType = frontmatter.type as SpecType | undefined;

  let valid = false;
  let validationErrors: ValidationResult["errors"] = null;
  if (specType) {
    const result = validateSpec(specType, data);
    valid = result.valid;
    validationErrors = result.errors;
  }

  return {
    filePath,
    frontmatter,
    content: "",
    sections: [],
    parsedSections: [],
    valid,
    validationErrors,
  };
}

function extractParsedSections(markdown: string): ParsedSection[] {
  const tree = unified().use(remarkParse).parse(markdown);

  const h2s: { heading: string; startOffset: number; endOffset: number }[] = [];

  visit(tree, "heading", (node) => {
    if (node.depth === 2) {
      const text = (node.children as Array<{ type: string; value?: string }>)
        .filter((c) => c.type === "text")
        .map((c) => c.value ?? "")
        .join("");
      h2s.push({
        heading: text,
        startOffset: node.position!.start.offset as number,
        endOffset: node.position!.end.offset as number,
      });
    }
  });

  const sections: ParsedSection[] = [];

  // Preamble: content before first H2
  const firstH2 = h2s[0];
  const firstOffset = firstH2 ? firstH2.startOffset : markdown.length;
  const preamble = markdown.slice(0, firstOffset).trim();
  if (preamble) {
    sections.push({ heading: "", content: preamble, tokens: countTokens(preamble) });
  }

  // Each H2 section: content AFTER the heading line, up to the next H2 (or end)
  for (let i = 0; i < h2s.length; i++) {
    const current = h2s[i]!;
    const next = h2s[i + 1];
    const end = next ? next.startOffset : markdown.length;
    const content = markdown.slice(current.endOffset, end).trim();
    sections.push({
      heading: current.heading,
      content,
      tokens: countTokens(content),
    });
  }

  return sections;
}

import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import * as grayMatterNs from "gray-matter";
import { parse as parseYaml } from "yaml";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { visit } from "unist-util-visit";
import { validateSpec, type ValidationResult } from "@sdx/schema";
import type { BaseSpec, SpecType } from "@sdx/schema";

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

export interface ParsedSpec {
  filePath: string;
  frontmatter: BaseSpec & Record<string, unknown>;
  content: string;
  sections: string[];
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

  const ext = extname(filePath).toLowerCase();
  if (ext === ".yaml" || ext === ".yml") {
    return parseYamlSpec(filePath, raw);
  }
  return parseMarkdownSpec(filePath, raw);
}

function parseMarkdownSpec(filePath: string, raw: string): ParsedSpec {
  const { data, content } = matter(raw);
  const sections = extractSections(content);
  const frontmatter = data as BaseSpec & Record<string, unknown>;
  const specType = frontmatter.type as SpecType | undefined;

  let valid = false;
  let validationErrors: ValidationResult["errors"] = null;
  if (specType) {
    const result = validateSpec(specType, data);
    valid = result.valid;
    validationErrors = result.errors;
  }

  return { filePath, frontmatter, content, sections, valid, validationErrors };
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

  return { filePath, frontmatter, content: "", sections: [], valid, validationErrors };
}

function extractSections(markdown: string): string[] {
  const tree = unified().use(remarkParse).parse(markdown);
  const sections: string[] = [];

  visit(tree, "heading", (node: any) => {
    if (node.depth === 2) {
      const text = node.children
        .filter((c: any) => c.type === "text")
        .map((c: any) => c.value)
        .join("");
      if (text) sections.push(text);
    }
  });

  return sections;
}

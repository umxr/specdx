import type { ExtractedType } from "../types.js";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const PRISMA_TYPE_MAP: Record<string, string> = {
  String: "string",
  Int: "number",
  Float: "number",
  Decimal: "number",
  BigInt: "number",
  Boolean: "boolean",
  DateTime: "Date",
  Json: "unknown",
  Bytes: "Buffer",
};

/**
 * Every place Prisma keeps a schema, in the order Prisma itself prefers.
 *
 * Only the project root was read, and `prisma init` has never written there --
 * it writes `prisma/schema.prisma`. So a real Prisma project's models were
 * invisible, every one of them was reported as unimplemented, and the coverage
 * score dropped to match, with no note saying a schema had been looked for.
 *
 * `prisma/schema/` is the multi-file layout supported since Prisma 5.15.
 */
export async function findPrismaSchemas(projectDir: string): Promise<string[]> {
  const found: string[] = [];

  for (const relative of ["prisma/schema.prisma", "schema.prisma"]) {
    const path = join(projectDir, relative);
    try {
      await readFile(path, "utf-8");
      found.push(path);
    } catch {
      // not there; try the next layout
    }
  }

  const schemaDir = join(projectDir, "prisma", "schema");
  try {
    for (const entry of await readdir(schemaDir)) {
      if (entry.endsWith(".prisma")) found.push(join(schemaDir, entry));
    }
  } catch {
    // no multi-file schema directory
  }

  return found;
}

export async function extractPrismaModels(projectDir: string): Promise<ExtractedType[]> {
  const schemaPaths = await findPrismaSchemas(projectDir);
  if (schemaPaths.length === 0) return [];

  const models: ExtractedType[] = [];
  for (const schemaPath of schemaPaths) {
    models.push(...parseSchema(await readFile(schemaPath, "utf-8"), schemaPath));
  }
  return models;
}

function parseSchema(content: string, schemaPath: string): ExtractedType[] {
  const models: ExtractedType[] = [];
  const modelRe = /^model\s+(\w+)\s*\{([^}]+)\}/gm;
  let modelMatch;

  while ((modelMatch = modelRe.exec(content)) !== null) {
    const name = modelMatch[1]!;
    const body = modelMatch[2]!;
    const fields: ExtractedType["fields"] = [];
    const lineOffset = content.slice(0, modelMatch.index).split("\n").length;

    for (const line of body.split("\n")) {
      const fieldMatch = /^\s+(\w+)\s+(\w+)(\??)/.exec(line);
      if (!fieldMatch) continue;

      const fieldName = fieldMatch[1]!;
      const prismaType = fieldMatch[2]!;
      const optional = fieldMatch[3] === "?";

      // Skip relation fields (type references another model or is array)
      if (line.includes("@relation") || prismaType.endsWith("[]") || line.trim().endsWith("[]"))
        continue;
      // Also skip if the type is not a known Prisma scalar (it's a relation)
      if (!PRISMA_TYPE_MAP[prismaType] && /^[A-Z]/.test(prismaType)) continue;

      const tsType = PRISMA_TYPE_MAP[prismaType] ?? prismaType.toLowerCase();
      fields.push({ name: fieldName, type: tsType, optional });
    }

    models.push({ name, fields, file: schemaPath, line: lineOffset });
  }

  return models;
}

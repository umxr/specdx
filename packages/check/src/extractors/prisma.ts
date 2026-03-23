import type { ExtractedType } from "../types.js";
import { readFile } from "node:fs/promises";
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

export async function extractPrismaModels(projectDir: string): Promise<ExtractedType[]> {
  const schemaPath = join(projectDir, "schema.prisma");
  let content: string;
  try {
    content = await readFile(schemaPath, "utf-8");
  } catch {
    return [];
  }

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

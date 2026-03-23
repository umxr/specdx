import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ExtractedType } from "../types.js";

/**
 * Extract TypeScript interface and type alias definitions from source files using ts-morph AST parsing.
 *
 * @param projectDir - Root directory of the project (or fixtures dir in tests)
 * @param typesDir   - Sub-directory to scan, relative to projectDir. Defaults to "."
 */
export async function extractTypeScriptTypes(
  projectDir: string,
  typesDir?: string,
): Promise<ExtractedType[]> {
  const scanDir = typesDir ? join(projectDir, typesDir) : projectDir;

  if (!existsSync(scanDir)) {
    return [];
  }

  // Lazy-load ts-morph so the package works without it installed.
  let tsMorph: typeof import("ts-morph");
  try {
    tsMorph = await import("ts-morph");
  } catch {
    throw new Error("ts-morph is required for type extraction. Install it: pnpm add -D ts-morph");
  }

  const { Project, SyntaxKind } = tsMorph;

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: true },
  });

  // Add all .ts files from the scan directory, excluding tests and node_modules.
  project.addSourceFilesAtPaths([
    join(scanDir, "**/*.ts"),
    `!${join(scanDir, "**/*.test.ts")}`,
    `!${join(scanDir, "**/*.spec.ts")}`,
    `!${join(scanDir, "**/node_modules/**")}`,
  ]);

  const types: ExtractedType[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();

    // Extract interfaces.
    for (const iface of sourceFile.getInterfaces()) {
      const name = iface.getName();
      const line = sourceFile.getLineAndColumnAtPos(iface.getStart()).line;
      const fields = extractProperties(iface.getProperties());
      types.push({ name, fields, file: filePath, line });
    }

    // Extract type aliases that define object types (with properties).
    for (const typeAlias of sourceFile.getTypeAliases()) {
      const typeNode = typeAlias.getTypeNode();
      if (!typeNode) continue;

      // Only process object type literals (skip simple aliases like `type X = string`).
      if (typeNode.getKind() !== SyntaxKind.TypeLiteral) continue;

      const typeLiteral = typeNode.asKindOrThrow(SyntaxKind.TypeLiteral);
      const properties = typeLiteral.getProperties();
      if (properties.length === 0) continue;

      const name = typeAlias.getName();
      const line = sourceFile.getLineAndColumnAtPos(typeAlias.getStart()).line;
      const fields = extractProperties(properties);
      types.push({ name, fields, file: filePath, line });
    }
  }

  return types;
}

/**
 * Convert a list of ts-morph property signatures into the ExtractedType fields format.
 */
function extractProperties(
  properties: import("ts-morph").PropertySignature[],
): ExtractedType["fields"] {
  return properties.map((prop) => {
    const name = prop.getName();
    const optional = prop.hasQuestionToken();

    // Prefer the type as written in source; fall back to the resolved type text.
    let type = prop.getTypeNode()?.getText() ?? prop.getType().getText();

    // Strip import() paths that ts-morph sometimes includes, e.g. `import("x").Foo` → `Foo`.
    type = type.replace(/import\([^)]+\)\./g, "");

    return { name, type, optional };
  });
}

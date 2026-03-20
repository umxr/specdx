import { existsSync } from "node:fs";
import { join } from "node:path";
import type { ExtractedType } from "../types.js";

/**
 * Extract Zod object schemas from TypeScript source files using ts-morph AST parsing.
 *
 * Scans for variable declarations of the form:
 *   export const FooSchema = z.object({ ... });
 * and converts them to ExtractedType entries, stripping the `Schema` suffix from the name.
 *
 * @param projectDir - Root directory of the project (or fixtures dir in tests)
 * @param typesDir   - Sub-directory to scan, relative to projectDir. Defaults to "."
 */
export async function extractZodSchemas(
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
    throw new Error(
      "ts-morph is required for Zod schema extraction. Install it: pnpm add -D ts-morph",
    );
  }

  const { Project, SyntaxKind } = tsMorph;

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: true },
  });

  // Add all .ts and .js files from the scan directory, excluding tests and node_modules.
  project.addSourceFilesAtPaths([
    join(scanDir, "**/*.ts"),
    join(scanDir, "**/*.js"),
    `!${join(scanDir, "**/*.test.ts")}`,
    `!${join(scanDir, "**/*.test.js")}`,
    `!${join(scanDir, "**/*.spec.ts")}`,
    `!${join(scanDir, "**/*.spec.js")}`,
    `!${join(scanDir, "**/node_modules/**")}`,
  ]);

  const types: ExtractedType[] = [];

  for (const sourceFile of project.getSourceFiles()) {
    const filePath = sourceFile.getFilePath();

    const varDeclarations = sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration);

    for (const varDecl of varDeclarations) {
      const initializer = varDecl.getInitializer();
      if (!initializer) continue;
      if (initializer.getKind() !== SyntaxKind.CallExpression) continue;

      // Walk up the call chain looking for a z.object(...) call.
      // The pattern may be z.object({...}).strict() or similar — walk the chain.
      const zObjectCall = findZObjectCall(initializer, SyntaxKind);
      if (!zObjectCall) continue;

      // Get the argument to z.object() — must be an ObjectLiteralExpression.
      const args = zObjectCall.asKindOrThrow(SyntaxKind.CallExpression).getArguments();
      if (args.length === 0) continue;
      const firstArg = args[0];
      if (!firstArg) continue;
      if (firstArg.getKind() !== SyntaxKind.ObjectLiteralExpression) continue;

      const objLiteral = firstArg.asKindOrThrow(SyntaxKind.ObjectLiteralExpression);

      // Derive the type name: strip "Schema" suffix from the variable name.
      const rawName = varDecl.getName();
      const typeName = rawName.endsWith("Schema") ? rawName.slice(0, -"Schema".length) : rawName;

      const fields: ExtractedType["fields"] = [];

      for (const prop of objLiteral.getProperties()) {
        // Only handle PropertyAssignment (not shorthand, spread, etc.)
        if (prop.getKind() !== SyntaxKind.PropertyAssignment) continue;

        const propAssign = prop.asKindOrThrow(SyntaxKind.PropertyAssignment);
        const fieldName = propAssign.getName();
        const fieldInit = propAssign.getInitializer();
        if (!fieldInit) continue;

        const { type: fieldType, optional } = inferZodType(fieldInit, SyntaxKind);

        fields.push({ name: fieldName, type: fieldType, optional });
      }

      const lineNumber = sourceFile.getLineAndColumnAtPos(varDecl.getStart()).line;

      types.push({ name: typeName, fields, file: filePath, line: lineNumber });
    }
  }

  return types;
}

/**
 * Walk a call expression chain to find the `z.object(...)` call.
 * Handles chained calls like `z.object({...}).strict()`.
 */
function findZObjectCall(
  node: import("ts-morph").Node,
  SyntaxKind: typeof import("ts-morph").SyntaxKind,
): import("ts-morph").Node | undefined {
  if (node.getKind() !== SyntaxKind.CallExpression) return undefined;

  const callExpr = node.asKindOrThrow(SyntaxKind.CallExpression);
  const expr = callExpr.getExpression();

  // Direct: z.object(...)
  if (isZObjectAccess(expr, SyntaxKind)) {
    return node;
  }

  // Chained: someCall(...).method(...) — recurse into the callee
  if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
    const propAccess = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
    const innerExpr = propAccess.getExpression();
    if (innerExpr.getKind() === SyntaxKind.CallExpression) {
      return findZObjectCall(innerExpr, SyntaxKind);
    }
  }

  return undefined;
}

/**
 * Returns true if the given node is a `z.object` property access.
 */
function isZObjectAccess(
  node: import("ts-morph").Node,
  SyntaxKind: typeof import("ts-morph").SyntaxKind,
): boolean {
  if (node.getKind() !== SyntaxKind.PropertyAccessExpression) return false;
  const propAccess = node.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
  if (propAccess.getName() !== "object") return false;
  const receiver = propAccess.getExpression();
  return receiver.getKind() === SyntaxKind.Identifier && receiver.getText() === "z";
}

/**
 * Infer the TypeScript type and optional flag from a Zod call chain.
 *
 * Examples:
 *   z.string()            → { type: "string",          optional: false }
 *   z.date().optional()   → { type: "Date",             optional: true  }
 *   z.enum(["a","b"])     → { type: '"a" | "b"',        optional: false }
 */
function inferZodType(
  node: import("ts-morph").Node,
  SyntaxKind: typeof import("ts-morph").SyntaxKind,
): { type: string; optional: boolean } {
  // Collect all method names in the chain and find the base z.<type>() call.
  const chainMethods: string[] = [];
  let baseCallNode: import("ts-morph").Node | undefined;

  let current: import("ts-morph").Node = node;

  // Walk from the outermost call inward, collecting method names.
  while (current.getKind() === SyntaxKind.CallExpression) {
    const callExpr = current.asKindOrThrow(SyntaxKind.CallExpression);
    const expr = callExpr.getExpression();

    if (expr.getKind() === SyntaxKind.PropertyAccessExpression) {
      const propAccess = expr.asKindOrThrow(SyntaxKind.PropertyAccessExpression);
      const methodName = propAccess.getName();
      const receiver = propAccess.getExpression();

      if (receiver.getKind() === SyntaxKind.Identifier && receiver.getText() === "z") {
        // This is the base z.<type>() call.
        baseCallNode = current;
        chainMethods.push(methodName);
        break;
      } else {
        // Intermediate method in the chain (e.g., .optional(), .email(), etc.)
        chainMethods.push(methodName);
        current = receiver;
      }
    } else {
      break;
    }
  }

  const optional = chainMethods.includes("optional");

  // The last entry in chainMethods (from our walk) is the base Zod type method name.
  // Because we push inner methods last, the base type is the last element.
  const baseMethodName = chainMethods[chainMethods.length - 1];

  let type = "unknown";

  if (baseMethodName === "string") {
    type = "string";
  } else if (baseMethodName === "number") {
    type = "number";
  } else if (baseMethodName === "boolean") {
    type = "boolean";
  } else if (baseMethodName === "date") {
    type = "Date";
  } else if (baseMethodName === "array") {
    type = "array";
  } else if (baseMethodName === "enum" && baseCallNode) {
    // z.enum(["a", "b"]) → "a" | "b"
    const enumCall = baseCallNode.asKindOrThrow(SyntaxKind.CallExpression);
    const args = enumCall.getArguments();
    if (args.length > 0) {
      const firstArg = args[0];
      if (firstArg && firstArg.getKind() === SyntaxKind.ArrayLiteralExpression) {
        const arrayLiteral = firstArg.asKindOrThrow(SyntaxKind.ArrayLiteralExpression);
        const elements = arrayLiteral
          .getElements()
          .filter((el) => el.getKind() === SyntaxKind.StringLiteral)
          .map((el) => el.asKindOrThrow(SyntaxKind.StringLiteral).getText());
        if (elements.length > 0) {
          type = elements.join(" | ");
        }
      }
    }
  }

  return { type, optional };
}

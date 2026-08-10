import type { Finding, SpecTypeDefinition, ExtractedType } from "../types.js";

const STRIP_SUFFIXES = ["Schema", "Model", "Type", "Interface", "Entity"];

function normaliseTypeName(name: string): string {
  let normalised = name;
  for (const suffix of STRIP_SUFFIXES) {
    if (normalised.endsWith(suffix) && normalised.length > suffix.length) {
      normalised = normalised.slice(0, -suffix.length);
      break;
    }
  }
  return normalised.toLowerCase();
}

function findMatchingCodeType(
  specType: SpecTypeDefinition,
  codeTypes: ExtractedType[],
): ExtractedType | undefined {
  const specNorm = normaliseTypeName(specType.name);
  return codeTypes.find((ct) => normaliseTypeName(ct.name) === specNorm);
}

export function matchTypes(
  specTypes: SpecTypeDefinition[],
  codeTypes: ExtractedType[],
  specId: string,
): Finding[] {
  const findings: Finding[] = [];

  for (const specType of specTypes) {
    const codeType = findMatchingCodeType(specType, codeTypes);

    if (!codeType) {
      findings.push({
        type: "missing",
        category: "type",
        specId,
        specSection: "Data Models",
        expected: `Type: ${specType.name}`,
        severity: "error",
        suggestion: `Implement type "${specType.name}" in code`,
        // The score's types denominator counts fields; an absent type must
        // subtract all of its fields, not 1, or a project that implements
        // nothing of an N-field model scores (N-1)/N.
        weight: specType.fields.length,
      });
      continue;
    }

    // Build a set of field names present in the code type
    const codeFieldNames = new Set(codeType.fields.map((f) => f.name));
    const specFieldNames = new Set(specType.fields.map((f) => f.name));

    // Missing fields: in spec but not in code
    for (const specField of specType.fields) {
      if (!codeFieldNames.has(specField.name)) {
        findings.push({
          type: "missing",
          category: "type",
          specId,
          specSection: "Data Models",
          codeLocation: { file: codeType.file, line: codeType.line },
          expected: `Field ${specType.name}.${specField.name} (${specField.type})`,
          severity: "warn",
          suggestion: `Add field "${specField.name}: ${specField.type}" to ${codeType.name}`,
        });
      }
    }

    // Extra fields: in code but not in spec
    for (const codeField of codeType.fields) {
      if (!specFieldNames.has(codeField.name)) {
        findings.push({
          type: "extra",
          category: "type",
          specId,
          specSection: "Data Models",
          codeLocation: { file: codeType.file, line: codeType.line },
          expected: "(not in spec)",
          actual: `Field ${codeType.name}.${codeField.name} (${codeField.type})`,
          severity: "info",
          suggestion: `Field "${codeField.name}" exists in code but not in spec — add to spec if intentional`,
        });
      }
    }
  }

  return findings;
}

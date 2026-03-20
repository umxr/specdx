export interface CheckResult {
  findings: Finding[];
  score: ImplementationScore;
  summary: string;
}

export interface Finding {
  type: "missing" | "extra" | "mismatch" | "drift";
  category: "route" | "type" | "test";
  specId: string;
  specSection?: string;
  codeLocation?: { file: string; line: number };
  expected: string;
  actual?: string;
  severity: "error" | "warn" | "info";
  suggestion?: string;
}

export interface ImplementationScore {
  overall: number;
  byCategory: Record<string, { matched: number; total: number }>;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ExtractedRoute {
  method: HttpMethod;
  path: string;
  params: string[];
  file: string;
  line: number;
}

export interface ExtractedType {
  name: string;
  fields: { name: string; type: string; optional: boolean }[];
  file: string;
  line: number;
}

export interface ExtractedTest {
  description: string;
  file: string;
  line: number;
}

export interface SpecEndpoint {
  method: HttpMethod;
  path: string;
  params: string[];
  description?: string;
}

export interface SpecTypeDefinition {
  name: string;
  fields: { name: string; type: string; optional: boolean }[];
}

export interface SpecTestCase {
  description: string;
  section?: string;
}

export interface CheckConfig {
  framework?: "auto" | "express" | "hono" | "nextjs";
  routes_dir?: string;
  app_dir?: string;
  types_dir?: string;
  tests_dir?: string;
  ignore?: string[];
}

export interface AiAssessment {
  findingIndex: number;
  isRealIssue: boolean;
  confidence: "high" | "medium" | "low";
  reasoning: string;
  suggestedFix?: string;
}

export interface AiCheckResult {
  findings: Finding[];
  assessments: AiAssessment[];
  summary: string;
}

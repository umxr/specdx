import type { SpecType } from "./types.js";

export const REQUIRED_SECTIONS: Record<SpecType, string[]> = {
  prd: ["Problem Statement", "Goals", "Non-Goals", "Features", "Success Criteria"],
  "technical-design": [
    "Overview",
    "Architecture",
    "Data Model",
    "API Design",
    "Dependencies",
    "Risks",
    "Open Questions",
  ],
  "user-story": ["Description", "Acceptance Criteria", "Dependencies", "Notes"],
  "test-plan": ["Scope", "Test Cases", "Coverage Matrix", "Edge Cases"],
  adr: ["Context", "Decision", "Status", "Consequences"],
  "api-contract": ["Endpoints", "Request/Response Schemas", "Auth", "Error Codes"],
  epic: ["Overview", "Stories", "Acceptance Criteria", "Dependencies"],
  "quick-spec": ["Intent", "Boundaries", "Tasks"],
  "project-context": ["Technology Stack", "Critical Implementation Rules", "Coding Patterns"],
};

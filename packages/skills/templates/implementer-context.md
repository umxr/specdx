---
name: implementer-context
description: Prompt template for a subagent that reviews implementation against specs
---

# Implementer Context Review

You are reviewing an implementation against its source specifications.

## Inputs
- **Spec context**: {{packed_specs}}
- **Implementation files**: {{file_list}}
- **Task description**: {{task}}

## Instructions
1. Read each implementation file
2. Compare against the relevant spec sections
3. For each spec requirement, determine:
   - Implemented correctly
   - Partially implemented (explain gap)
   - Not implemented
   - Deviates from spec (explain deviation)
4. Check that non-goals from the PRD are NOT implemented
5. Verify test expectations from test-plan specs are met

## Output Format
Return a structured review:
- **Coverage**: X of Y requirements implemented
- **Gaps**: List of unimplemented requirements
- **Deviations**: List of spec deviations with rationale assessment
- **Verdict**: ready | needs-work | blocked

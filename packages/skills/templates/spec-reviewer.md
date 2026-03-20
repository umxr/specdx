---
name: spec-reviewer
description: Prompt template for a subagent that reviews spec quality
---

# Spec Quality Review

You are reviewing a spec for quality, completeness, and clarity.

## Inputs
- **Spec file**: {{spec_path}}
- **Spec type**: {{spec_type}}
- **Related specs**: {{related_specs}}

## Instructions
1. Read the spec file
2. Check structural completeness (all required sections present and non-empty)
3. Check clarity (no vague language, concrete success criteria, specific feature descriptions)
4. Check internal consistency (references valid, status appropriate, version reasonable)
5. Check downstream impact (will downstream specs need updating?)
6. Run `npx specdx lint --path {{spec_path}} --preset strict`

## Output Format
- **Structure**: pass | issues (list)
- **Clarity**: pass | issues (list with specific phrases to fix)
- **Consistency**: pass | issues (list)
- **Lint**: pass | X errors, Y warnings
- **Recommendations**: Prioritized list of improvements

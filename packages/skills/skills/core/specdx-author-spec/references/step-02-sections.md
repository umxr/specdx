---
step: 2
name: Sections
description: Write sections one at a time, lint after every 2-3 sections
---

# Step 2: Write Sections

## Write sections one at a time

For each required section:
1. Explain what the section should contain
2. Ask the user for their thoughts
3. Draft the section
4. Refine based on feedback

### PRD tips
- Use **F1**, **F2** etc. for features — the `story-coverage` lint rule checks each has a user story
- Be specific in Non-Goals — this prevents scope creep

### Technical Design tips
- Include concrete field names and types in Data Model
- List specific risks with likelihood and mitigation

### ADR tips
- State the decision in one clear sentence, then elaborate
- List both positive AND negative consequences

### User Story tips
- Acceptance criteria should be testable
- Include the priority and estimate in frontmatter

### Test Plan tips
- Coverage matrix should map to features from the PRD
- Edge cases are often where bugs hide — be thorough

### API Contract tips
- Include both success and error response schemas
- Document auth requirements per endpoint

## Lint after every 2-3 sections

```bash
npx specdx lint --path <file>
```

Common issues:

| Issue | Fix |
|---|---|
| Vague language ("as appropriate", "etc.", "TBD") | Replace with concrete language |
| Missing required section | Add it, even if minimal |
| Broken reference | Check the referenced spec ID exists |

<HARD-GATE>
Do NOT skip the lint step between sections. Run `npx specdx lint --path <file>`
after every 2-3 sections. Do NOT write the entire spec and lint at the end.
</HARD-GATE>

## Sections `specdx check` parses

Three sections are read by `specdx check` and compared against code. Prose in
them is fine, but the entries themselves must take one of these shapes or the
section is reported as not assessed — which silently removes it from the
coverage score.

**`## Endpoints`** (api-contract) — a bullet per endpoint, a `###` heading per
endpoint, or both:

```markdown
- `GET /invoices` — list invoices
- POST /invoices — create an invoice

### DELETE /invoices/:id

Void an invoice.
```

**`## Data Model`** (technical-design) — a `###` heading per type, one field per
line as `- name: type`. Backticks are optional. The heading must be a single
identifier: `### Notes on the model` is read as prose, not as a type.

```markdown
### Invoice

- id: string
- `amountCents`: number
- paidAt?: Date
```

**`## Test Cases`** (test-plan) — one bullet per case, optionally grouped under
`###` headings:

```markdown
### Invoices

- creates an invoice with a valid payload
- rejects an invoice with a negative amount
```

## Rationalizations to Resist

| Thought | Reality |
|---------|---------|
| "I'll lint at the end, it's faster" | Lint catches issues early. Fixing 1 issue now beats fixing 10 later. |
| "This section is simple, no need to lint" | Simple sections have frontmatter and reference issues too. |
| "The user seems in a hurry" | Shipping a broken spec wastes more time than linting. |
| "I already know the lint rules" | Rules evolve. Run the tool. |

---
**Next:** When all sections are written and linting clean, read `step-03-finalize.md` in this directory.

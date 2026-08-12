---
name: specdx-router
description: Ask which specdx workflow fits your situation. A map over the spec-driven flow — authoring, planning, implementing, verifying, shipping — and where the human decisions sit.
disable-model-invocation: true
allowed-tools: Bash(npx specdx:*)
---

# Which specdx workflow fits?

You describe where you are. This names the workflow and the next thing to run.

It recommends and stops. It does not author a spec, build a plan, or fire the
skill it names — what you get back is the next thing to type.

## The main flow

Idea → spec → plan → implement → verify → commit. Most work enters at step 1
or step 3.

| Step | Skill | The decision it leaves you |
|---|---|---|
| 1. Capture intent | `specdx-author-spec` | Which spec type, and whether this needs a spec at all |
| 2. Quality-gate the spec | `specdx-review-spec` | Whether the spec is concrete enough to build from |
| 3. Load context | `specdx-start-task` | Nothing — run it before every coding session |
| 4. Plan the build | `specdx-plan-from-spec` | Slice order, and what to defer |
| 5. Ship it | `specdx-pre-commit` | Whether downstream specs get updated now or later |

## Route by situation

| Where you are | What to reach for |
|---|---|
| New to this repo, don't know what the specs say | `specdx-onboard` |
| About to write code | `specdx-start-task` — always, before the first edit |
| An idea that isn't written down yet | `specdx-author-spec` |
| A spec exists but feels vague | `specdx-review-spec` |
| A spec is solid, need an approach | `specdx-plan-from-spec` |
| About to commit | `specdx-pre-commit` |
| Reporting progress to other people | `specdx-sprint-review` |
| Wondering if the code still matches the specs | `specdx-verify` (experimental) |
| Wondering if the specs still match the code | `specdx-check-drift` (experimental) |

The last two are experimental: they are built on `specdx check`, whose static
analysis is noisy on prose-heavy specs. Treat their findings as prompts to look,
not as failures.

## Distinctions that are easy to get wrong

- **`specdx-start-task` vs `specdx-plan-from-spec`** — turns on whether you know
  the approach. `start-task` loads context so you can begin. `plan-from-spec`
  decides the order of work first. A one-file change needs the former only.
- **`specdx-verify` vs `specdx-check-drift`** — turns on which side you suspect.
  `verify` asks "did I build what the spec said". `check-drift` asks "have the
  specs fallen behind the code".
- **`specdx-review-spec` vs `specdx lint`** — turns on what kind of problem.
  `lint` catches structural and mechanical faults. `review-spec` judges whether
  the content is decision-ready.

## When you don't need any of this

A typo fix, a dependency bump, a rename with no behaviour change. Spec context
costs tokens and attention; spend it where intent is genuinely at stake.

## It's working if

You leave knowing the single next command to type, and why the neighbouring
skill was not it. If two skills still look interchangeable after reading this,
the router has failed — say so, because that is a bug in this file.

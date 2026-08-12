---
step: 3
name: Finalize
description: Register in spec.config.yaml, run final validation
---

# Step 3: Finalize

## Register in spec.config.yaml

If this is a new spec, add it to `spec.config.yaml`:

```yaml
specs:
  new-spec:
    path: specs/new-spec.md
    type: technical-design
    requires: ["prd"]
```

The `requires` field establishes dependency relationships used by `specdx graph` and `specdx pack`.

If the spec replaces an existing entry, update the path. If it's a glob pattern (e.g. `specs/stories/*.md`), no config change is needed — the new file is picked up automatically.

## Final validation

Run the full validation suite:

```bash
npx specdx lint --path <file> --preset strict
npx specdx lint
npx specdx validate
npx specdx graph
```

This verifies:
- The new spec passes strict linting
- The full suite still passes (no broken cross-references)
- The config is valid
- The dependency graph is acyclic

## Report

Provide the user with:
- **Spec type** and file path
- **Lint status** (pass/fail, any remaining warnings)
- **Graph position** (what it depends on, what depends on it)
- **Next steps** (e.g. "run `npx specdx pack --task '...'` to include this spec in LLM context")

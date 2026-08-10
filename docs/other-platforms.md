# Using specdx skills outside Claude Code

specdx ships ten skills. They are plain Markdown files with YAML frontmatter,
and the `npx specdx` commands inside them run anywhere — only the file location
and the discovery mechanism differ per platform.

Claude Code is set up for you: install specdx as a dev dependency and the
plugin is discovered automatically, or run `specdx skills install` to write the
files into `.claude/skills/`. This guide covers everything else.

## Where the skill files live

Inside the installed package:

```
node_modules/specdx/dist/skills/<bucket>/<name>/SKILL.md
```

`<bucket>` is `core` or `experimental`. The eight core skills are the promoted
set; the two experimental ones are built on `specdx check`.

```bash
ls node_modules/specdx/dist/skills/core            # promoted skills
ls node_modules/specdx/dist/skills/experimental    # check-based skills
ls $(npm root -g)/specdx/dist/skills/core          # if installed globally
```

| Bucket | Skills |
|---|---|
| `core` | `specdx-router`, `specdx-start-task`, `specdx-author-spec`, `specdx-plan-from-spec`, `specdx-review-spec`, `specdx-pre-commit`, `specdx-onboard`, `specdx-sprint-review` |
| `experimental` | `specdx-verify`, `specdx-check-drift` |

Start with `specdx-router` — it maps every skill and the flows between them.

Each skill is a directory holding a `SKILL.md`, per the
[Agent Skills specification](https://agentskills.io/specification). Some carry
extra files in `references/`; copy the whole directory, not just the `SKILL.md`,
or those references break.

## Cursor

Cursor reads custom commands from `.cursor/commands/` in the project, or
`~/.cursor/commands/` globally. It expects flat `.md` files, so copy each
`SKILL.md` under the skill's own name:

```bash
mkdir -p .cursor/commands
for dir in node_modules/specdx/dist/skills/core/*/; do
  cp "$dir/SKILL.md" ".cursor/commands/$(basename "$dir").md"
done
```

Reload the window (`Cmd+Shift+P` → "Developer: Reload Window"). The commands
then appear in the chat panel:

- `/specdx-start-task implement user authentication`
- `/specdx-author-spec`

Committing `.cursor/commands/` gives the whole team the same commands.

## Gemini CLI

Gemini CLI discovers `.gemini/commands/*.md` at session start:

```bash
mkdir -p .gemini/commands
for dir in node_modules/specdx/dist/skills/core/*/; do
  cp "$dir/SKILL.md" ".gemini/commands/$(basename "$dir").md"
done
```

Then reference one in a prompt:

```
@specdx-start-task implement the payment flow
```

If your version does not support a `commands/` subdirectory, put the files
directly in `.gemini/`.

## What carries over, and what does not

- **The skill body is platform-agnostic.** It describes what to do and which
  `npx specdx` commands to run. That is identical everywhere.
- **`allowed-tools` is Claude Code-specific.** Other platforms ignore it and
  apply their own permissions model.
- **Keep `description` intact.** It is how a platform decides when a command is
  relevant.
- **Re-copy after upgrading specdx.** These are copies, not links, so skill
  changes do not reach them on their own.

| Platform | Location | Layout |
|---|---|---|
| Claude Code | `.claude/skills/<name>/SKILL.md` | Directory per skill |
| Cursor | `.cursor/commands/<name>.md` | Flat file |
| Gemini CLI | `.gemini/commands/<name>.md` | Flat file |

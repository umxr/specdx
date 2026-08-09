# specdx Skills: Setup for Cursor and Gemini CLI

specdx ships two skills for Claude Code: `specdx-author-spec` and `specdx-start-task`. These are plain markdown files with YAML frontmatter. The `npx specdx` commands inside them work on any platform — only the file location and discovery mechanism differs.

This guide covers manual setup for Cursor and Gemini CLI.

---

## Skill files

After installing specdx, the skill files live in the package:

```
node_modules/specdx/skills/specdx-author-spec.md
node_modules/specdx/skills/specdx-start-task.md
```

Or clone/download them directly from the specdx npm package:

```bash
npx specdx skills --list   # shows available skills
```

If you have specdx installed globally or as a dev dependency, you can also copy from the installed location:

```bash
ls $(npm root -g)/specdx/skills/          # global install
ls node_modules/specdx/skills/            # local install
```

---

## Cursor

Cursor supports custom AI commands via markdown files placed in `.cursor/commands/` in your project or `~/.cursor/commands/` for global access.

### Setup

1. Create the commands directory:

   ```bash
   mkdir -p .cursor/commands
   ```

2. Copy the skill files:

   ```bash
   cp node_modules/specdx/skills/specdx-author-spec.md .cursor/commands/
   cp node_modules/specdx/skills/specdx-start-task.md .cursor/commands/
   ```

3. Restart Cursor (or reload the window: `Cmd+Shift+P` → "Developer: Reload Window").

### Using the skills in Cursor

Once the files are in `.cursor/commands/`, they appear as custom commands in the Cursor chat panel. You can invoke them by typing `/` followed by the command name, or reference them in chat:

- `/specdx-start-task implement user authentication`
- `/specdx-author-spec` — starts guided spec authoring

### Notes

- The `allowed-tools` frontmatter field is Claude Code-specific and is ignored by Cursor. Cursor uses its own tool permissions model.
- The `description` field in the frontmatter helps Cursor surface the right command — keep it intact.
- `npx specdx` commands in the skill bodies work as-is since Cursor runs bash commands in your project's shell environment.

### Project vs. global

| Location | Scope |
|---|---|
| `.cursor/commands/` | Project only (checked into repo) |
| `~/.cursor/commands/` | All projects on your machine |

For team setups, committing `.cursor/commands/` to the repo ensures everyone has the same skills available.

---

## Gemini CLI

Gemini CLI (Google's `gemini` CLI tool) supports custom instructions and commands via markdown files placed in `.gemini/` in your project directory.

### Setup

1. Create the Gemini commands directory:

   ```bash
   mkdir -p .gemini/commands
   ```

2. Copy the skill files:

   ```bash
   cp node_modules/specdx/skills/specdx-author-spec.md .gemini/commands/
   cp node_modules/specdx/skills/specdx-start-task.md .gemini/commands/
   ```

3. Restart the Gemini CLI session.

### Using the skills in Gemini CLI

Invoke skills by referencing them in your prompt:

```
@specdx-start-task implement the payment flow
```

Or load them explicitly:

```
Use the specdx-start-task skill to load context for adding email authentication.
```

### Notes

- Gemini CLI discovers `.gemini/commands/*.md` files at session start.
- The `allowed-tools` frontmatter field is Claude Code-specific and has no effect in Gemini CLI; tool access is governed by Gemini CLI's own settings.
- The `npx specdx` commands in the skill bodies execute in your project's shell environment and work without modification.
- If Gemini CLI does not yet support a `commands/` subdirectory in your installed version, place the files directly in `.gemini/`:

  ```bash
  cp node_modules/specdx/skills/specdx-author-spec.md .gemini/
  cp node_modules/specdx/skills/specdx-start-task.md .gemini/
  ```

---

## Platform-agnostic notes

- **Skill content is platform-agnostic.** The markdown body of each skill file describes what to do and which `npx specdx` commands to run. This content is identical regardless of platform.
- **`npx specdx` works everywhere.** As long as specdx is installed (globally or as a dev dependency), `npx specdx lint`, `npx specdx pack`, `npx specdx validate`, and `npx specdx graph` all work in any shell environment.
- **Only file placement differs.** Each platform has its own directory convention for discovering custom commands. The table below summarizes them:

| Platform | Directory | Scope |
|---|---|---|
| Claude Code | `.claude/skills/<name>/SKILL.md` | Project |
| Cursor | `.cursor/commands/` | Project |
| Gemini CLI | `.gemini/commands/` | Project |
| Codex | `~/.agents/skills/` | Global |

- **Keeping skills up to date.** Re-run the copy commands above after upgrading specdx to pick up any changes to skill content.

import { defineCommand } from "citty";
import { installSkills } from "@sdx/skills";

export default defineCommand({
  meta: { name: "skills", description: "Manage sdx skills for AI coding tools" },
  subCommands: {
    install: defineCommand({
      meta: { name: "install", description: "Install Claude Code skill files" },
      args: {
        dir: {
          type: "string",
          description: "Target directory (default: current directory)",
          default: ".",
        },
      },
      async run({ args }) {
        try {
          const result = await installSkills(args.dir);
          if (result.installed.length === 0 && result.updated.length === 0) {
            console.log("  No skill files to install.");
            return;
          }
          for (const file of result.installed) console.log(`  ✓ Installed ${file}`);
          for (const file of result.updated) console.log(`  ✓ Updated ${file}`);
          console.log(`\n  Skills installed to .claude/skills/`);
        } catch (err) {
          console.error(`\n  ✗ ${(err as Error).message}\n`);
          process.exit(1);
        }
      },
    }),
  },
});

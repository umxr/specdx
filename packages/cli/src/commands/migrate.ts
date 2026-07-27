import { defineCommand } from "citty";
import { loadConfig, createLogger } from "@specdx/core";
import { SPEC_TYPES } from "@specdx/schema";

export default defineCommand({
  meta: { name: "migrate", description: "[experimental] Check and migrate spec suite schema" },
  args: {
    quiet: { type: "boolean", description: "Suppress output" },
  },
  async run({ args }) {
    const logger = createLogger({ quiet: args.quiet });
    const configDir = process.cwd();

    try {
      const config = await loadConfig(undefined, configDir);
      logger.info(`\n  Config version: ${config.version}`);
      logger.info(`  Supported spec types: ${SPEC_TYPES.join(", ")}`);

      const unknownTypes: string[] = [];
      for (const [key, entry] of Object.entries(config.specs)) {
        if (!SPEC_TYPES.includes(entry.type as (typeof SPEC_TYPES)[number])) {
          unknownTypes.push(`${key}: ${entry.type}`);
        }
      }

      if (unknownTypes.length > 0) {
        logger.info(`\n  Unknown spec types found:`);
        for (const ut of unknownTypes) {
          logger.info(`    - ${ut}`);
        }
        logger.info(`\n  Update specdx to resolve.\n`);
        process.exit(1);
      } else {
        logger.info(`\n  ✓ All spec types are recognized. No migration needed.\n`);
      }
    } catch (err) {
      console.error(`\n  ✗ ${(err as Error).message}\n`);
      process.exit(1);
    }
  },
});

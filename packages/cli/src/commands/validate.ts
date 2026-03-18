import { defineCommand } from "citty";
import { loadConfig, ConfigError } from "@sdx/core";
import { sharedArgs } from "../shared-args.js";

export default defineCommand({
  meta: { name: "validate", description: "Validate spec.config.yaml" },
  args: { ...sharedArgs },
  async run() {
    try {
      const config = await loadConfig(undefined, process.cwd());
      console.log(`  ✓ Config valid. ${Object.keys(config.specs).length} specs defined.`);
    } catch (err) {
      if (err instanceof ConfigError) {
        console.error(`  ✗ Config invalid: ${err.message}`);
        if (err.errors) {
          for (const e of err.errors) console.error(`    - ${JSON.stringify(e)}`);
        }
        process.exit(1);
      }
      throw err;
    }
  },
});

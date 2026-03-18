export const sharedArgs = {
  quiet: { type: "boolean" as const, description: "Suppress info output", alias: ["q"] },
  verbose: { type: "boolean" as const, description: "Enable debug output", alias: ["V"] },
  format: {
    type: "string" as const,
    description: "Output format (pretty, json, github)",
    default: "pretty",
  },
};

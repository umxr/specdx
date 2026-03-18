import { defineCommand } from "citty";
export const runLint = async () => ({ diagnostics: [], hasErrors: false, hasWarnings: false });
export default defineCommand({ meta: { name: "lint", description: "Lint specs (coming soon)" }, run() { console.log("lint not implemented yet"); } });

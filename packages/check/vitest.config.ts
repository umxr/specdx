import { mergeConfig } from "vitest/config";
import shared from "../../vitest.shared.js";

export default mergeConfig(shared, {
  test: {
    // These tests parse real TypeScript with ts-morph, which loads the whole
    // compiler and builds an AST per Project. Locally that is a few hundred
    // milliseconds; on a two-core CI runner it is slower by an order of
    // magnitude, and the shared 15s default -- tuned for fast unit tests -- has
    // already blown once on a release PR without anything being wrong.
    testTimeout: 60000,
  },
});

import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // Reuses the app's `@/*` path alias so tests import modules exactly as the
  // application does, with no separate resolution rules to drift.
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/setup.ts"],
    // Integration tests share one Postgres database; running files in parallel
    // would let one file's cleanup race another's fixtures.
    fileParallelism: false,
    testTimeout: 20_000,
    reporters: ["default"],
  },
});

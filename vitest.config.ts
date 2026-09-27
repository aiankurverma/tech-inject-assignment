import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "packages/*/src/**/*.test.ts",
      "packages/*/test/**/*.test.ts",
      "plugins/*/src/**/*.test.ts",
      "apps/*/src/**/*.test.ts",
      "apps/*/test/**/*.test.ts",
    ],
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});

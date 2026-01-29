import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/checkouts/**"],
    testTimeout: 15000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/**/*.test.ts", "src/test-utils.ts"],
      reporter: ["text", "html"],
    },
    benchmark: {
      include: ["benchmarks/**/*.bench.ts"],
      exclude: ["**/node_modules/**", "**/checkouts/**"],
    },
  },
});

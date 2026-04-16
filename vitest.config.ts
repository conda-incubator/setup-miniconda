import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "json-summary", "html"],
      include: ["src/**/*.ts"],
      exclude: ["src/__tests__/**", "src/types.ts", "src/typings.d.ts"],
      thresholds: {
        // Some branches are platform-specific (Windows/Linux paths
        // unreachable on macOS) so 100% is only achievable in CI
        // with a multi-OS matrix. These thresholds are the floor.
        lines: 94,
        branches: 88,
        functions: 98,
        statements: 93,
      },
    },
  },
});

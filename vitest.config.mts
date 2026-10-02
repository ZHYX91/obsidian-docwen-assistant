import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/i18n/catalogs.ts", "src/i18n/types.ts"],
      reporter: ["text", "json-summary"],
      thresholds: {
        statements: 72,
        branches: 63,
        functions: 69,
        lines: 76,
      },
    },
  },
});

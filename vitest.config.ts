import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Pure-logic unit tests run in a Node environment (no React Native / Expo).
// Only `lib/**` deep modules (money, dates, balance service, dedup, resolvers)
// are covered here; RN/DB/UI tests use a separate harness (jest-expo) later.
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["lib/**/*.test.ts", "db/**/*.test.ts"],
  },
});

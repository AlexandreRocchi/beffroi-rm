import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["shared/test/**/*.test.ts", "server/test/**/*.test.ts"],
    environment: "node",
    hookTimeout: 60_000,
    testTimeout: 30_000,
  },
});

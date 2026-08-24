import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // RLS tests share one Postgres database; running files in parallel would let
    // fixture resets race each other.
    fileParallelism: false,
    hookTimeout: 60_000,
    testTimeout: 30_000,
    include: ["test/**/*.spec.ts"],
  },
  resolve: {
    alias: { "@octa/contracts": new URL("../../packages/contracts/src/index.ts", import.meta.url).pathname },
  },
});

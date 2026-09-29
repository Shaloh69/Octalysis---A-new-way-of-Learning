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
    // Exact matches, one per entry. A prefix alias on "@octa/contracts" turned
    // the "/env" subpath (30 Sep 2026) into ".../index.ts/env", and every suite
    // that booted the server failed to import.
    alias: [
      {
        find: /^@octa\/contracts\/env$/,
        replacement: new URL("../../packages/contracts/src/env.ts", import.meta.url).pathname,
      },
      {
        find: /^@octa\/contracts$/,
        replacement: new URL("../../packages/contracts/src/index.ts", import.meta.url).pathname,
      },
    ],
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5174 },
  build: {
    // Same rule as apps/web: no source maps. scripts/scan-bundle.mjs treats a
    // shipped .map as a finding -- it hands a reader the original module names,
    // and the console's modules are named after teacher-only operations.
    sourcemap: false,
  },
  resolve: {
    alias: {
      "@octa/contracts": new URL("../../packages/contracts/src/index.ts", import.meta.url).pathname,
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    // Source maps are NOT emitted. scripts/scan-bundle.mjs treats a shipped .map
    // as a finding: it hands a reader the original module names.
    sourcemap: false,
    // NO manualChunks for three.js, deliberately.
    //
    // Forcing it into a named chunk made Vite emit
    //   <link rel="modulepreload" href="/assets/three-*.js">
    // into index.html, so every student downloaded 221 KB gzipped of 3D on
    // first paint even if they never opened the galaxy -- exactly what
    // VISUAL-SYSTEM-3D.md 5 forbids. Letting Rollup place three inside the
    // dynamic GalaxyCanvas chunk means it is fetched only when the student
    // opts in. Verified by grepping dist/index.html for a preload link.
    rollupOptions: {},
  },
  resolve: {
    alias: { "@octa/contracts": new URL("../../packages/contracts/src/index.ts", import.meta.url).pathname },
  },
});

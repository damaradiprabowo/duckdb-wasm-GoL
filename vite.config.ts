import { defineConfig } from "vite";

export default defineConfig({
  // DuckDB-WASM ships its own workers/wasm; let it resolve at runtime from the
  // CDN bundles rather than having Vite pre-bundle it.
  optimizeDeps: {
    exclude: ["@duckdb/duckdb-wasm"],
  },
  build: {
    target: "esnext", // top-level await + modern WASM features
  },
});

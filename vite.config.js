import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: "app.html",
      output: {
        // Keep the production bundle as a single file so make-standalone.mjs
        // can inline it; dynamic imports are still split in dev mode.
        inlineDynamicImports: true,
      },
    },
  },
});

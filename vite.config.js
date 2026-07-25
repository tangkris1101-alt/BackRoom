import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
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

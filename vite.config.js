import { defineConfig } from "vite";

export default defineConfig(({ mode }) => {
  const standalone = mode === "standalone";

  return {
    base: "./",
    server: {
      proxy: {
        "/api": "http://127.0.0.1:8787",
      },
    },
    preview: {
      proxy: {
        "/api": "http://127.0.0.1:8787",
      },
    },
    build: {
      outDir: standalone ? ".standalone-dist" : "dist",
      emptyOutDir: true,
      // Explicit gzip budgets are enforced by check-web-build.mjs. These raw
      // limits avoid warnings for the expected app and standalone bundles.
      chunkSizeWarningLimit: standalone ? 1800 : 900,
      rollupOptions: standalone ? undefined : {
        input: "app.html",
        output: {
          // Three.js changes less often than the game code, so browsers can
          // retain it when a later deployment only changes gameplay/UI code.
          manualChunks(id) {
            if (id.includes("/node_modules/three/") || id.includes("\\node_modules\\three\\")) return "three";
            return undefined;
          },
        },
      },
      // The online build keeps dynamic level chunks. Only the temporary
      // standalone build disables splitting so it can be inlined into one HTML.
      rolldownOptions: standalone ? {
        input: "app.html",
        output: { codeSplitting: false },
      } : undefined,
    },
  };
});

import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        index: "index.html",
        app: "app.html",
      },
    },
  },
});

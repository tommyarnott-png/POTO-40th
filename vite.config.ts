import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // Audio is served straight from public/ and is already compressed; there is
  // nothing for the bundler to gain by inlining or re-processing it.
  build: {
    assetsInlineLimit: 0,
  },
});

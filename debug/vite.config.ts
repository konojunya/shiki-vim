import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "shiki-vim/styles.css": path.resolve(__dirname, "../src/styles.css"),
      "shiki-vim": path.resolve(__dirname, "../src/index.ts"),
    },
  },
});

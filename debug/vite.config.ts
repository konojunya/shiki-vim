import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "react.vim/styles.css": path.resolve(__dirname, "../src/styles.css"),
      "react.vim": path.resolve(__dirname, "../src/index.ts"),
    },
  },
});

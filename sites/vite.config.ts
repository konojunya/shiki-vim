import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { version } = require("react.vim/package.json");

export default defineConfig({
  plugins: [react()],
  define: {
    __SHIKI_VIM_VERSION__: JSON.stringify(version),
  },
});

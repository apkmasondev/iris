import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative base so the same build works at the domain root and under a
  // GitHub Pages project subpath.
  base: "./",
  publicDir: "assets",
  plugins: [react()],
  build: {
    target: "es2022",
    sourcemap: false,
    // The only asset the bundler sees is a 900-byte SVG favicon; anything else
    // lives in publicDir and must stay a separate, range-requestable file.
    assetsInlineLimit: 2048,
    // Nothing here is worth gzipping twice just to print a number.
    reportCompressedSize: false,
  },
});

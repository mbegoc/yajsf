import { defineConfig } from "vite";
import { resolve } from "path";


// https://vitejs.dev/config/
export default defineConfig({
  build: {
    minify: false,
    sourcemap: true,
    lib: {
        entry: resolve(__dirname, "src/build.ts"),
        formats: ["es"],
    },
    rollupOptions: {
      output: {
        entryFileNames: (chunkInfo) => {
          return "yajsf.js"; // Keep file unhashed
        },
        // Naming patterns for various output file types
        chunkFileNames: "[name].js",
        assetFileNames: "[name].[ext]",
      },
    },
  },
});


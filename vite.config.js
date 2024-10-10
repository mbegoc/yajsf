import { defineConfig } from "vite";
import { resolve } from "path";


// https://vitejs.dev/config/
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        entryFileNames: (chunkInfo) => {
          return "[name].js"; // Keep file unhashed
        },
        // Naming patterns for various output file types
        chunkFileNames: "assets/[name].js",
        assetFileNames: "assets/[name].[ext]",
      },
    },
  },
});


import { defineConfig } from "vite";
import packageJson from "./package.json";
import { isDev, r, sharedConfig } from "./vite.config";

// bundling the content script using Vite
export default defineConfig({
  ...sharedConfig,
  define: {
    "__DEV__": isDev,
    "__NAME__": JSON.stringify(packageJson.name),
    // https://github.com/vitejs/vite/issues/9320
    // https://github.com/vitejs/vite/issues/9186
    "process.env.NODE_ENV": JSON.stringify(isDev ? "development" : "production"),
  },
  // assetsInclude: ["**/*.css"],
  build: {
    watch: isDev
      ? {}
      : undefined,
    outDir: r("extension/dist"),
    cssCodeSplit: false,
    emptyOutDir: false,
    sourcemap: "inline", // isDev ? "inline" : false,
    rollupOptions: {
      input: {
        popup: r("src/extension/popup/main.ts"),
        player: r("src/extension/player/main.ts"),
      },
      output: {
        // format: "iife",
        entryFileNames: "[name]/main.mjs",
        inlineDynamicImports: false,
        extend: true,
      },
    },
  },
});

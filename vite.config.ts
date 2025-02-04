/// <reference types="vitest" />

import { dirname, relative, resolve } from "node:path";
import type { UserConfig } from "vite";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import packageJson from "./package.json";

export const r = (...args: string[]) => resolve(__dirname, ...args);

export const port = parseInt(process.env.PORT ?? "") || 3303;
export const isDev = process.env.NODE_ENV !== "production";
export const isFirefox = process.env.EXTENSION === "firefox";

export const sharedConfig: UserConfig = {
  root: r("src/extension"),
  resolve: {
    alias: {
      "~/": `${r("src/extension")}/`,
    },
  },
  define: {
    "__DEV__": isDev,
    "__NAME__": JSON.stringify(packageJson.name),
  },
  plugins: [
    // rewrite assets to use relative path
    {
      name: "assets-rewrite",
      enforce: "post",
      apply: "build",
      transformIndexHtml(html, { path }) {
        return html.replace(/"\/assets\//g, `"${relative(dirname(path), "/assets")}/`);
      },
    },
  ],
  optimizeDeps: {
    include: [
      "webextension-polyfill",
    ],
  },
};

export default defineConfig(({ command }) => ({
  ...sharedConfig,
  base: command === "serve" ? `http://localhost:${port}/` : "/dist/",
  server: {
    port,
    hmr: {
      host: "localhost",
    },
  },
  plugins: [
    mkcert(),
  ],
  build: {
    watch: isDev
      ? {}
      : undefined,
    outDir: r("extension/dist"),
    emptyOutDir: false,
    sourcemap: "inline", // isDev ? "inline" : false,
    // https://developer.chrome.com/docs/webstore/program_policies/#:~:text=Code%20Readability%20Requirements
    terserOptions: {
      mangle: false,
    },
    rollupOptions: {
      watch: isDev
        ? {}
        : undefined,
      input: {
        options: r("src/extension/options/index.html"),
        player: r("src/extension/player/index.html"),
        popup: r("src/extension/popup/index.html"),
      },
      output: {
        assetFileNames: "assets/[name]-[hash][extname]",
        entryFileNames: "[name]/[name]-[hash].js",
      }
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
  },
}));

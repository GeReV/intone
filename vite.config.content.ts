// vite.config.content.ts
import { defineConfig } from 'vite'
import { isDev, r, sharedConfig } from './vite.config'

export default defineConfig({
  ...sharedConfig,
  define: {
    ...sharedConfig.define,
    'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production'),
  },
  build: {
    outDir: r('extension/dist/contentScripts'),
    emptyOutDir: false,
    sourcemap: 'inline',
    rollupOptions: {
      input: { index: r('src/extension/content/index.ts') },
      output: {
        format: 'iife',
        entryFileNames: '[name].js',
        inlineDynamicImports: true,
      },
    },
  },
})

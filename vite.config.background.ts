// vite.config.background.ts
import { defineConfig } from 'vite'
import packageJson from './package.json'
import { isDev, r, sharedConfig } from './vite.config'

export default defineConfig({
  ...sharedConfig,
  define: {
    ...sharedConfig.define,
    'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production'),
  },
  build: {
    outDir: r('extension/dist/background'),
    emptyOutDir: false,
    sourcemap: isDev ? 'inline' : false,
    lib: {
      entry: r('src/background/main.ts'),
      name: packageJson.name,
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        entryFileNames: 'index.js',
        extend: true,
      },
    },
  },
})

// vite.config.ts
import { resolve } from 'node:path'
import type { UserConfig } from 'vite'
import { defineConfig } from 'vite'

export const r = (...args: string[]) => resolve(__dirname, ...args)
export const isDev = process.env.NODE_ENV !== 'production'
export const isFirefox = process.env.EXTENSION === 'firefox'

export const sharedConfig: UserConfig = {
  root: r('src'),
  resolve: {
    alias: { '~/': `${r('src')}/` },
  },
  define: {
    __DEV__: isDev,
  },
  optimizeDeps: {
    include: ['webextension-polyfill'],
  },
}

export default defineConfig({
  ...sharedConfig,
  base: './',
  build: {
    outDir: r('extension/dist'),
    emptyOutDir: false,
    rollupOptions: {
      input: {
        options: r('src/extension/options/index.html'),
      },
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        entryFileNames: '[name]/[name].js',
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['../test/**/*.test.ts'],
  },
})

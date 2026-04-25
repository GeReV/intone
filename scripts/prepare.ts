// scripts/prepare.ts
import { execSync } from 'node:child_process'
import { watch } from 'node:fs'
import { isDev, r } from '../vite.config'

function writeManifest() {
  execSync('yarn tsx ./scripts/manifest.ts', { stdio: 'inherit' })
}

writeManifest()

if (isDev) {
  // Re-run on manifest or package.json changes using Node's built-in fs.watch.
  // Debounce because fs.watch fires multiple events per save on many systems.
  let debounceTimer: ReturnType<typeof setTimeout> | undefined
  const debouncedWrite = () => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(writeManifest, 100)
  }
  for (const file of [r('src/manifest.ts'), r('package.json')]) {
    watch(file, debouncedWrite)
  }
}

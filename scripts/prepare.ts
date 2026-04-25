// scripts/prepare.ts
import { execSync } from 'node:child_process'
import { isDev, r } from '../vite.config'

function writeManifest() {
  execSync('yarn tsx ./scripts/manifest.ts', { stdio: 'inherit' })
}

writeManifest()

if (isDev) {
  // Re-run on manifest or package.json changes using Node's built-in fs.watch
  const { watch } = await import('node:fs')
  for (const file of [r('src/manifest.ts'), r('package.json')]) {
    watch(file, () => { writeManifest() })
  }
}

// scripts/manifest.ts
import fs from 'fs-extra'
import { getManifest } from '~/extension/manifest'
import { r } from '../vite.config'

export async function writeManifest(): Promise<void> {
  await fs.writeJSON(r('extension/manifest.json'), await getManifest(), { spaces: 2 })
  console.log('[PRE] write manifest.json')
}

void writeManifest()

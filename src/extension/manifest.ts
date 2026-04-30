// src/manifest.ts
import fs from 'fs-extra'
import type { Manifest } from 'webextension-polyfill'
import type PkgType from '../../package.json'
import { isDev, isFirefox, r } from '../../vite.config'

export async function getManifest(): Promise<Manifest.WebExtensionManifest> {
  const pkg = await fs.readJSON(r('package.json')) as typeof PkgType

  return {
    manifest_version: 3,
    name: pkg.displayName || pkg.name,
    version: pkg.version,
    description: pkg.description,
    default_locale: 'en',

    action: {
      default_icon: './assets/icon-128.png',
    },

    background: isFirefox
      ? { scripts: ['dist/background/index.js'], type: 'module' }
      : { service_worker: './dist/background/index.js' },

    options_ui: {
      page: './dist/extension/options/index.html',
      open_in_tab: true,
    },

    icons: {
      16: './assets/icon-16.png',
      48: './assets/icon-48.png',
      128: './assets/icon-128.png',
    },

    permissions: [
      'tabs',
      'storage',
      'contextMenus',
      'activeTab',
    ],

    content_scripts: [
      {
        matches: ['<all_urls>'],
        js: ['dist/contentScripts/index.global.js'],
      },
    ],

    content_security_policy: {
      extension_pages: isDev
        ? "script-src 'self' 'unsafe-eval'; object-src 'self'; connect-src 'self' http://localhost:* http://127.0.0.1:*"
        : "script-src 'self'; object-src 'self'; connect-src 'self' http://localhost:* http://127.0.0.1:*",
    },

    browser_specific_settings: {
      gecko: {
        id: '{acc6d7a2-f165-4019-9fba-0b72cfeed277}',
        strict_min_version: '121.0',
      },
    },

    commands: {
      play: {
        suggested_key: { default: 'Alt+P' },
        description: 'Play / pause',
      },
      stop: {
        suggested_key: { default: 'Alt+O' },
        description: 'Stop',
      },
      forward: {
        suggested_key: { default: 'Alt+Period' },
        description: 'Next sentence',
      },
      rewind: {
        suggested_key: { default: 'Alt+Comma' },
        description: 'Previous sentence',
      },
    },
  }
}

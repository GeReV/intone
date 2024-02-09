import fs from "fs-extra";
import type { Manifest } from "webextension-polyfill";
import type PkgType from "../../package.json";
import { isDev, isFirefox, port, r } from "../../vite.config";

export async function getManifest() {
  const pkg = await fs.readJSON(r("package.json")) as typeof PkgType;

  // update this file to update this manifest.json
  // can also be conditional based on your need
  const manifest: Manifest.WebExtensionManifest = {
    manifest_version: 3,
    name: pkg.displayName || pkg.name,
    version: pkg.version,
    description: pkg.description,
    default_locale: "en",
    action: {
      default_icon: "./assets/icon-512.png",
      default_popup: "./dist/popup/index.html?isPopup=1",
    },
    options_ui: {
      page: "./dist/options/index.html",
      open_in_tab: true,
    },
    background: isFirefox
      ? {
        scripts: ["dist/background/index.mjs"],
        type: "module",
      }
      : {
        service_worker: "./dist/background/index.mjs",
      },
    icons: {
      16: "./assets/icon-512.png",
      48: "./assets/icon-512.png",
      128: "./assets/icon-512.png",
    },
    permissions: [
      "tabs",
      "storage",
      "scripting",
      "contextMenus",
      "activeTab",
    ],
    host_permissions: ["*://*/*"],
    content_scripts: [
      {
        matches: [
          "<all_urls>",
        ],
        js: [
          "dist/contentScripts/index.global.js",
        ],
      },
    ],
    web_accessible_resources: [
      {
        resources: [
          // "dist/contentScripts/popup.css",
          "dist/player/index.html",
          "dist/assets/silence.mp3",
        ],
        matches: ["<all_urls>"],
      },
    ],
    content_security_policy: {
      extension_pages: isDev
        // this is required on dev for Vite script to load
        ? `script-src 'self' https://localhost:${port}; object-src 'self'`
        : "script-src 'self'; object-src 'self'",
    },
    commands: {
      forward: {
        suggested_key: { "default": "Alt+Period" },
        description: "forward"
      },
      play: {
        suggested_key: { "default": "Alt+P" },
        description: "play/pause"
      },
      rewind: {
        suggested_key: { "default": "Alt+Comma" },
        description: "rewind"
      },
      stop: {
        suggested_key: { "default": "Alt+O" },
        description: "stop"
      }
    }
  };

  // FIXME: not work in MV3
  // if (isDev && false) {
  //   // for content script, as browsers will cache them for each reload,
  //   // we use a background script to always inject the latest version
  //   // see src/background/contentScriptHMR.ts
  //   delete manifest.content_scripts;
  //   manifest.permissions?.push("webNavigation");
  // }

  return manifest;
}

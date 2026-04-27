# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn dev              # Start development build (all entry points, watch mode)
yarn dev-firefox      # Development build targeting Firefox
yarn build            # Production build (Chrome/Chromium)
yarn build:firefox    # Production build for Firefox

yarn lint             # Run ESLint
yarn typecheck        # Type-check without emitting

yarn test             # Run Vitest tests
yarn start:server     # Start the Piper TTS Docker container (requires NVIDIA GPU + Docker)

yarn pack             # Package extension into .zip / .crx / .xpi
yarn start:chromium   # Launch extension in Chromium with web-ext
yarn start:firefox    # Launch extension in Firefox Developer Edition with web-ext
```

After `yarn dev`, load the **`extension/`** folder directly in the browser as an unpacked extension.

## Architecture

### Extension contexts

The extension runs across four separate JS execution contexts. Communication between them uses `webext-bridge` (background ↔ content script) and the native `MessageChannel` API (content script ↔ player iframe).

| Context | Entry point | Built by |
|---|---|---|
| Background service worker | `src/extension/background/main.ts` | `vite.config.background.ts` |
| Content script (injected into every page) | `src/extension/contentScripts/main.ts` | `vite.config.content.ts` |
| Popup + Player + Options pages | `src/extension/popup/`, `player/`, `options/` | `vite.config.ts` + `vite.config.popup.ts` |

### Playback data flow

1. **Background** (`background/main.ts`) receives play commands (from popup, context menu, or keyboard shortcut). It sets `sourceUri` in `browser.storage.local` and forwards the command to the **content script** via `webext-bridge`.
2. **Content script** (`contentScripts/main.ts`) lazily instantiates `Player`. It dispatches to `Doc` → `Speech`, which injects the **player iframe** (`dist/player/index.html`) into the page.
3. **Player iframe** (`player/main.ts`) owns the TTS engine and `<audio>` element. It communicates back to the content script via a `MessageChannel` port transferred at iframe load time.
4. `Speech` (`player/speech.ts`) manages per-utterance state and orchestrates the engine inside the player frame via typed port messages.
5. `Doc` (`player/doc.ts`) controls page-level sequencing (index into paragraphs, language detection, pause timing).

### Document parsing

`TabSource` (`player/sources.ts`) reads `sourceUri` from storage to determine how to get text. The default path delegates to `ReadabilityDoc` (`contentScripts/readabilityDoc.ts`), which runs Mozilla Readability on a cloned DOM and emits paragraph-level text arrays. `SimpleSource` is used for plain-text playback (context menu selections).

### TTS engine

The only active engine is `LocalTtsEngine` (`player/engines/localTtsEngine.ts`). It calls the locally running Piper TTS HTTP server (`http://localhost:5000` by default), fetches an audio blob, and plays it via `playAudio` in `player/audio.ts`. The server URL is configurable in extension settings.

The **Piper TTS server** runs via Docker Compose (`src/piper-tts/compose.yml`). It uses an NVIDIA GPU. The **Kokoro TTS** server (`src/kokoro-tts/`) is an alternative.

### Vite configuration

`vite.config.ts` exports `sharedConfig` (root = `src/extension/`, alias `~/` → `src/extension/`). All other Vite configs import and extend it. The build produces into `extension/dist/`; the `extension/` folder is the final unpacked extension.

`scripts/prepare.ts` generates `extension/manifest.json` from `src/extension/manifest.ts` as part of every build.

### Settings

Stored in `browser.storage.local`. The `Settings` type and defaults live in `utils/settings.ts`. Key settings: `voiceName`, `serverUrl`, `rate`, `volume`, `showHighlighting`, `preferredVoices`.

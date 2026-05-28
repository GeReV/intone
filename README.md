# Intone

A browser extension for reading web pages out loud using _locally run_ Text to Speech models. No cloud, no account — everything runs on your machine.

## Requirements

- Docker with CUDA support (for the TTS server)
- Node.js 18+ and Yarn (for development)
- Chrome/Chromium or Firefox Developer Edition

## Usage

**1. Start the TTS server**

```bash
yarn start:server
```

This launches the Piper TTS server via Docker Compose. A CUDA-capable NVIDIA GPU is required.

**2. Install the extension**

Load the `extension/` folder as an unpacked extension in your browser:

- **Chrome/Chromium**: go to `chrome://extensions`, enable Developer Mode, click "Load unpacked", and select the `extension/` folder.
- **Firefox**: go to `about:debugging`, click "This Firefox", then "Load Temporary Add-on" and select any file inside `extension/`.

**3. Use it**

Navigate to any article or web page, then click the Intone icon in your browser toolbar. The page content will be read aloud.

### Folders

- `src/extension/` — browser extension source code
  - `background/` — background service worker (receives play commands, coordinates state)
  - `content/` — content script injected into every page (DOM extraction, TTS playback, UI)
  - `options/` — options/settings page
  - `manifest.ts` — extension manifest (generates `extension/manifest.json` at build time)
- `src/server/` — Piper TTS HTTP server (Python, Docker)
- `extension/` — the unpacked extension root; load this folder in your browser
  - `assets/` — static assets (icons, etc.)
  - `dist/` — built JS/CSS output
- `scripts/` — build helper scripts

### Development

**Prerequisites**: Node.js 18+, Yarn, and the TTS server running (see above).

```bash
yarn install
yarn dev
```

Then load the `extension/` folder in your browser as an unpacked extension (see step 2 above). The build will watch for changes and rebuild automatically.

For Firefox:

```bash
yarn dev-firefox
```

`web-ext` can auto-reload the extension when files change:

```bash
yarn start:firefox   # Firefox Developer Edition
yarn start:chromium  # Chromium
```

### Build

```bash
yarn build           # Chrome/Chromium
yarn build:firefox   # Firefox
```

Then run `yarn pack` to produce `intone.zip`, `intone.crx`, and `intone.xpi` for distribution.

## Credits

- Heavily based on [Read Aloud](https://github.com/ken107/read-aloud) by [Hai Phan](https://github.com/ken107)
- [WebExtension Vite Starter Template](https://github.com/antfu/vitesse-webext) by [Anthony Fu](https://github.com/antfu)

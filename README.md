# Read Out

A browser extension for reading web pages out loud using _locally run_ Text to Speech models.

## Usage

**Note that the following requires a working Docker installation with CUDA capabilities.**

First, start the TTS server using the following command:

```bash
yarn start:server
```

TODO

### Folders

- `src` - main source.
    - `extension` - source code for the browser extension
        - `contentScript` - scripts and components to be injected as `content_script`
        - `background` - scripts for background.
        - `options` - scripts for options.
        - `popup` - scripts for background.
        - `player` - scripts for background.
        - `assets` - assets used in Vue components
        - `manifest.ts` - manifest for the extension.
    - `piper-tts` - files for [Piper TTS server](https://github.com/rhasspy/piper)
    - `coqui-tts` - files for [Coqui AI TTS server](https://github.com/coqui-ai/TTS) (unused)
    - `xtts-webui` - files for [XTTS Webui](https://github.com/daswer123/xtts-webui) (unused)
- `extension` - extension package root.
    - `assets` - static assets (mainly for `manifest.json`).
    - `dist` - built files, also serve stub entry for Vite on development.
- `scripts` - development and bundling helper scripts.

### Development

TODO

```bash
yarn dev
```

Then **load extension in browser with the `extension/` folder**.

For Firefox developers, you can run the following command instead:

```bash
yarn start:firefox
```

`web-ext` auto reload the extension when `extension/` files changed.

> While Vite handles HMR automatically in the most of the
> case, [Extensions Reloader](https://chrome.google.com/webstore/detail/fimgfedafeadlieiabdeeaodndnlbhid) is still
> recommanded for cleaner hard reloading.

### Build

To build the extension, run

```bash
yarn build
```

And then pack files under `extension`, you can upload `extension.crx` or `extension.xpi` to appropriate extension store.

## Credits

- Heavily based on [Read Aloud](https://github.com/ken107/read-aloud) by [Hai Phan](https://github.com/ken107)
- [WebExtension Vite Starter Template](https://github.com/antfu/vitesse-webext)
  by [Anthony Fu](https://github.com/antfu)


# Read Out — Rewrite Design

**Date:** 2026-04-24  
**Status:** Approved

## Overview

Rewrite the Read Out browser extension from scratch. The goal is a simpler, well-bounded architecture that drops all legacy dependencies and iframe indirection in favour of a self-contained content script that owns extraction, chunking, queuing, and playback.

## Requirements

- Read the current page aloud using a locally-running TTS HTTP server
- Maintain playback state across tab switches (audio continues playing; controls persist in DOM)
- Show floating controls on the page (play/pause, stop, forward, rewind)
- Queue and prefetch upcoming TTS chunks while the current one plays
- Break text into chunks at sentence boundaries before sending to the TTS server
- Pluggable text extractor with Mozilla Readability as the default; extractor selectable in settings
- Hook mechanism for site-specific extraction overrides (future use; interface defined now)
- Settings page: TTS server URL, extractor choice, rate, volume
- Support Chrome (MV3 service worker) and Firefox (MV3 persistent background)
- No external UI libraries; plain HTML + vanilla TypeScript for all UI
- Context menu ("Read selection") and keyboard shortcuts forwarded from background to content script

## Out of Scope (this iteration)

- Word-level highlighting during playback
- A browser action popup
- Any TTS engine other than the local HTTP server

## Architecture

### Execution contexts

| Context | Responsibility |
|---|---|
| Content script | Extraction, chunking, queuing, playback, floating UI |
| Background | Context menu registration, keyboard shortcut forwarding |
| Options page | Settings form |

The background holds no playback state. It wakes on events (MV3 service worker / MV3 Firefox background page), forwards a message to the active tab's content script via `browser.tabs.sendMessage`, and terminates. The content script is the single source of truth for all session state.

### Module structure

```
src/
  background/
    main.ts            # context menu + keyboard shortcut forwarding only (~30 lines)
  content/
    index.ts           # bootstrap: instantiates and wires all modules
    extractor/
      types.ts         # Extractor interface, ExtractionResult type, ExtractorHook interface
      readability.ts   # ReadabilityExtractor (default)
      hooks.ts         # static list of ExtractorHooks (empty to start)
    chunker.ts         # sentence-boundary splitting
    queue.ts           # ordered chunk list + prefetch blob URL cache
    player.ts          # TTS fetch, <audio> playback, onStateChange callback
    ui.ts              # injects and updates floating controls DOM
    settings.ts        # typed read/write wrapper for browser.storage.local
  options/
    index.html
    main.ts            # settings form
  manifest.ts          # generates extension/manifest.json
```

Nothing imports across sibling content modules. `index.ts` is the only place modules are wired together.

## Data Flow

```
Page DOM
  → Extractor.extract(document)
      returns { title: string, paragraphs: string[] }
  → apply first matching ExtractorHook.transform() if any
  → Chunker.chunk(paragraphs)
      splits each paragraph at sentence boundaries (.?!)
      returns string[] (flat list)
  → Queue.load(chunks)
      holds list, tracks currentIndex
  → Player drives loop:
      1. Queue.current() → fetch TTS audio → play via <audio>
      2. prefetch next 2–3 chunks in parallel → cache blob URLs in Queue
      3. <audio> ended → advance index → play next (cache hit if prefetch succeeded)
      4. skip forward/back → cancel in-flight audio → adjust index → play
  → Player calls onStateChange(state) on every transition
  → FloatingUI updates button visibility based on state
```

### Playback states

`idle | loading | playing | paused | stopped | error`

- `idle` — content script injected, no playback initiated yet
- `loading` — extraction + TTS fetch in progress, audio not yet started
- `playing` — audio is actively playing
- `paused` — audio paused mid-session, position retained
- `stopped` — user explicitly stopped; session cleared, queue reset
- `error` — unrecoverable failure; error message surfaced in controls

### onStateChange payload

```typescript
type PlaybackState = {
  state: "idle" | "loading" | "playing" | "paused" | "stopped" | "error";
  chunkIndex: number;
  totalChunks: number;
  error?: string;
};
```

## Interfaces

### Extractor

```typescript
interface ExtractionResult {
  title: string;
  paragraphs: string[];
}

interface Extractor {
  extract(document: Document): ExtractionResult;
}
```

### ExtractorHook

```typescript
interface ExtractorHook {
  matches(url: string): boolean;
  transform(result: ExtractionResult, document: Document): ExtractionResult;
}
```

Hooks are defined in `extractor/hooks.ts` as a plain array. At extract time `index.ts` runs the base extractor then applies the first matching hook. Adding a site-specific fix (e.g. Twitter) means adding one entry to that array — no changes to the extractor interface or the rest of the pipeline.

### Settings

```typescript
interface Settings {
  serverUrl: string;     // default: "http://localhost:5000"
  extractor: "readability";  // union grows as extractors are added
  rate: number;          // default: 1.0
  volume: number;        // default: 1.0
}
```

Read once at bootstrap. Changes on the options page take effect on next play. Options page is plain HTML + vanilla TS, one form, one save button.

## Floating Controls

Injected into the page by `ui.ts` as a single `<div>` with Shadow DOM to isolate styles. Buttons: play/pause (toggled by state), stop, forward, rewind. Also shows "chunk N of M". No external UI library.

Shadow DOM prevents page styles from bleeding into the controls and vice versa.

## Background Script

```typescript
// On install: register context menu
browser.contextMenus.create({ id: "read-selection", contexts: ["selection"] })

// Forward context menu click
browser.contextMenus.onClicked → tabs.sendMessage(activeTab, { type: "play-selection", text })

// Forward keyboard commands
browser.commands.onCommand → tabs.sendMessage(activeTab, { type: command })
// commands: "play", "stop", "forward", "rewind"
```

## Build

Three Vite entry points:

| Config | Output | Format |
|---|---|---|
| `vite.config.ts` | `extension/dist/contentScripts/index.global.js` | IIFE |
| `vite.config.background.ts` | `extension/dist/background/index.mjs` | IIFE |
| `vite.config.options.ts` | `extension/dist/options/` | HTML build |

`scripts/prepare.ts` generates `extension/manifest.json` from `src/manifest.ts`.  
Firefox build: `EXTENSION=firefox` env var — manifest emits `background.scripts` array instead of `background.service_worker`.

### Dependencies (runtime)

- `@mozilla/readability`
- `webextension-polyfill`

Dropped from current codebase: `webext-bridge`, Vue, `@iconify/json`, `vite-plugin-mkcert`.

## Piper TTS Server

Unchanged from current. Started with `yarn start:server` (Docker Compose, NVIDIA GPU required). Listens on `http://localhost:5000`. Content script fetches `GET /?text=<utterance>` and receives an audio blob.

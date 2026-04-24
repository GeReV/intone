# Read Out Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite the Read Out browser extension from scratch with a flat, content-script-only architecture that owns extraction, chunking, queuing, playback, and floating controls.

**Architecture:** The content script is the only stateful context. It runs Readability on the page, splits text at sentence boundaries, maintains a prefetch queue, plays audio via `<audio>`, and renders floating controls in a Shadow DOM host. The background script (~30 lines) forwards keyboard shortcuts, context menu, and toolbar-icon clicks to the active tab.

**Tech Stack:** TypeScript, Vite, `webextension-polyfill`, `@mozilla/readability`, `vitest`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/background/main.ts` | Create | Context menu, keyboard shortcuts, icon click → forward to content script |
| `src/content/index.ts` | Create | Bootstrap: wire all modules, handle `browser.runtime.onMessage` |
| `src/content/types.ts` | Create | `PlaybackState` type |
| `src/content/settings.ts` | Create | Read/write `browser.storage.local` with typed `Settings` |
| `src/content/extractor/types.ts` | Create | `Extractor`, `ExtractionResult`, `ExtractorHook` interfaces |
| `src/content/extractor/hooks.ts` | Create | Empty `HOOKS` array (site overrides added here later) |
| `src/content/extractor/readability.ts` | Create | `ReadabilityExtractor` implements `Extractor` |
| `src/content/chunker.ts` | Create | `chunk(paragraphs)` — sentence-boundary splitting |
| `src/content/queue.ts` | Create | `Queue` class — chunk list, index, prefetch blob URL cache |
| `src/content/player.ts` | Create | `Player` class — TTS fetch, `<audio>` playback, `onStateChange` callback |
| `src/content/ui.ts` | Create | `FloatingUI` class — Shadow DOM controls, button callbacks |
| `src/options/index.html` | Create | Settings page HTML |
| `src/options/main.ts` | Create | Settings page logic |
| `src/manifest.ts` | Modify | Remove popup/player iframe, point to new entry points |
| `vite.config.ts` | Modify | Root → `src/`, new test include, remove mkcert plugin |
| `vite.config.background.ts` | Modify | Entry → `src/background/main.ts` |
| `vite.config.content.ts` | Modify | Entry → `src/content/index.ts` |
| `vite.config.popup.ts` | Delete | Replaced by options-only build in `vite.config.ts` |
| `tsconfig.json` | Modify | Path alias `~/*` → `src/*` |
| `shim.d.ts` | Modify | Remove `webext-bridge` declarations, keep `__DEV__` |
| `test/content/chunker.test.ts` | Create | Vitest tests for `chunker.ts` |
| `test/content/queue.test.ts` | Create | Vitest tests for `queue.ts` |

---

### Task 1: Scaffold — remove old code, update configs

**Files:**
- Delete: `src/extension/` (entire directory)
- Delete: `vite.config.popup.ts`
- Modify: `vite.config.ts`
- Modify: `vite.config.background.ts`
- Modify: `vite.config.content.ts`
- Modify: `tsconfig.json`
- Modify: `shim.d.ts`
- Run: `yarn remove`

- [ ] **Step 1: Delete old source and dead config**

```bash
rm -rf src/extension
rm vite.config.popup.ts
```

- [ ] **Step 2: Overwrite vite.config.ts**

```typescript
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
  base: '/',
  build: {
    outDir: r('extension/dist'),
    emptyOutDir: false,
    rollupOptions: {
      input: {
        options: r('src/options/index.html'),
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
```

- [ ] **Step 3: Overwrite vite.config.background.ts**

```typescript
// vite.config.background.ts
import { defineConfig } from 'vite'
import packageJson from './package.json'
import { isDev, r, sharedConfig } from './vite.config'

export default defineConfig({
  ...sharedConfig,
  define: {
    ...sharedConfig.define,
    'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production'),
  },
  build: {
    outDir: r('extension/dist/background'),
    emptyOutDir: false,
    sourcemap: isDev ? 'inline' : false,
    lib: {
      entry: r('src/background/main.ts'),
      name: packageJson.name,
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        entryFileNames: 'index.mjs',
        extend: true,
      },
    },
  },
})
```

- [ ] **Step 4: Overwrite vite.config.content.ts**

```typescript
// vite.config.content.ts
import { defineConfig } from 'vite'
import packageJson from './package.json'
import { isDev, r, sharedConfig } from './vite.config'

export default defineConfig({
  ...sharedConfig,
  define: {
    ...sharedConfig.define,
    'process.env.NODE_ENV': JSON.stringify(isDev ? 'development' : 'production'),
  },
  build: {
    outDir: r('extension/dist/contentScripts'),
    emptyOutDir: false,
    sourcemap: isDev ? 'inline' : false,
    lib: {
      entry: r('src/content/index.ts'),
      name: packageJson.name,
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        entryFileNames: 'index.global.js',
        extend: true,
      },
    },
  },
})
```

- [ ] **Step 5: Update tsconfig.json** — change the path alias

In `tsconfig.json`, update `compilerOptions.paths`:
```json
"paths": {
  "~/*": ["src/*"]
}
```

- [ ] **Step 6: Overwrite shim.d.ts**

```typescript
// shim.d.ts
declare const __DEV__: boolean
```

- [ ] **Step 7: Remove unused packages**

```bash
yarn remove webext-bridge vite-plugin-mkcert @antfu/eslint-config @iconify/json chokidar kolorist
```

Expected: yarn removes packages without errors. `node_modules` and `yarn.lock` updated.

- [ ] **Step 8: Create source directories and test directories**

```bash
mkdir -p src/background src/content/extractor src/options test/content
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold rewrite — remove old extension code, update build configs"
```

---

### Task 2: Shared types and settings

**Files:**
- Create: `src/content/types.ts`
- Create: `src/content/settings.ts`

- [ ] **Step 1: Create src/content/types.ts**

```typescript
// src/content/types.ts
export type PlaybackState = {
  state: 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error'
  chunkIndex: number
  totalChunks: number
  error?: string
}
```

- [ ] **Step 2: Create src/content/settings.ts**

```typescript
// src/content/settings.ts
import browser from 'webextension-polyfill'

export type Settings = {
  serverUrl: string
  extractor: 'readability'
  rate: number
  volume: number
}

export const DEFAULT_SETTINGS: Settings = {
  serverUrl: 'http://localhost:5000',
  extractor: 'readability',
  rate: 1.0,
  volume: 1.0,
}

export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(Object.keys(DEFAULT_SETTINGS))
  return { ...DEFAULT_SETTINGS, ...(stored as Partial<Settings>) }
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  await browser.storage.local.set(settings)
}
```

- [ ] **Step 3: Commit**

```bash
git add src/content/types.ts src/content/settings.ts
git commit -m "feat: add PlaybackState type and Settings module"
```

---

### Task 3: Extractor interface and hooks scaffold

**Files:**
- Create: `src/content/extractor/types.ts`
- Create: `src/content/extractor/hooks.ts`

- [ ] **Step 1: Create src/content/extractor/types.ts**

```typescript
// src/content/extractor/types.ts
export type ExtractionResult = {
  title: string
  paragraphs: string[]
}

export interface Extractor {
  extract(document: Document): ExtractionResult
}

export interface ExtractorHook {
  matches(url: string): boolean
  transform(result: ExtractionResult, document: Document): ExtractionResult
}
```

- [ ] **Step 2: Create src/content/extractor/hooks.ts**

```typescript
// src/content/extractor/hooks.ts
import type { ExtractorHook } from './types'

// Add site-specific overrides here. First matching hook wins.
export const HOOKS: ExtractorHook[] = []
```

- [ ] **Step 3: Commit**

```bash
git add src/content/extractor/types.ts src/content/extractor/hooks.ts
git commit -m "feat: add Extractor interface and empty hooks registry"
```

---

### Task 4: Chunker (TDD)

**Files:**
- Create: `test/content/chunker.test.ts`
- Create: `src/content/chunker.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// test/content/chunker.test.ts
import { describe, expect, it } from 'vitest'
import { chunk } from '../../src/content/chunker'

describe('chunk', () => {
  it('splits a single sentence-terminated paragraph', () => {
    expect(chunk(['Hello world. How are you? Fine!'])).toEqual([
      'Hello world.',
      'How are you?',
      'Fine!',
    ])
  })

  it('flattens multiple paragraphs into one list', () => {
    expect(chunk(['First sentence.', 'Second paragraph. Third sentence.'])).toEqual([
      'First sentence.',
      'Second paragraph.',
      'Third sentence.',
    ])
  })

  it('trims surrounding whitespace from each chunk', () => {
    expect(chunk(['  Hello world.  How are you?  '])).toEqual([
      'Hello world.',
      'How are you?',
    ])
  })

  it('returns empty array for empty input', () => {
    expect(chunk([])).toEqual([])
  })

  it('returns a single chunk when there are no sentence boundaries', () => {
    expect(chunk(['Hello world'])).toEqual(['Hello world'])
  })

  it('drops empty strings', () => {
    expect(chunk(['', 'Hello.', ''])).toEqual(['Hello.'])
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
yarn test test/content/chunker.test.ts
```

Expected: FAIL — `Cannot find module '../../src/content/chunker'`

- [ ] **Step 3: Implement chunker.ts**

```typescript
// src/content/chunker.ts

// Split on whitespace that immediately follows a sentence-ending character.
const SENTENCE_BOUNDARY = /(?<=[.?!])\s+/

export function chunk(paragraphs: string[]): string[] {
  const result: string[] = []
  for (const paragraph of paragraphs) {
    const sentences = paragraph
      .split(SENTENCE_BOUNDARY)
      .map(s => s.trim())
      .filter(s => s.length > 0)
    result.push(...sentences)
  }
  return result
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
yarn test test/content/chunker.test.ts
```

Expected: PASS — 6 tests pass

- [ ] **Step 5: Commit**

```bash
git add src/content/chunker.ts test/content/chunker.test.ts
git commit -m "feat: add sentence-boundary chunker"
```

---

### Task 5: Queue (TDD)

**Files:**
- Create: `test/content/queue.test.ts`
- Create: `src/content/queue.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// test/content/queue.test.ts
import { beforeEach, describe, expect, it } from 'vitest'
import { Queue } from '../../src/content/queue'

describe('Queue', () => {
  let q: Queue

  beforeEach(() => {
    q = new Queue()
    q.load(['chunk 1', 'chunk 2', 'chunk 3'])
  })

  it('returns the first chunk as current after load', () => {
    expect(q.current()).toBe('chunk 1')
  })

  it('returns null when index is past the end', () => {
    q.advance()
    q.advance()
    q.advance()
    expect(q.current()).toBeNull()
  })

  it('advance moves to next chunk', () => {
    q.advance()
    expect(q.current()).toBe('chunk 2')
  })

  it('retreat moves to previous chunk', () => {
    q.advance()
    q.retreat()
    expect(q.current()).toBe('chunk 1')
  })

  it('retreat does not go below 0', () => {
    q.retreat()
    expect(q.index).toBe(0)
  })

  it('reports correct total', () => {
    expect(q.total).toBe(3)
  })

  it('reports correct index', () => {
    q.advance()
    expect(q.index).toBe(1)
  })

  it('peek returns chunk at arbitrary index without moving current', () => {
    expect(q.peek(2)).toBe('chunk 3')
    expect(q.index).toBe(0)
  })

  it('peek returns null for out-of-range index', () => {
    expect(q.peek(99)).toBeNull()
  })

  it('stores and retrieves prefetch blob URLs', () => {
    q.setPrefetch(1, 'blob:mock-url')
    expect(q.getPrefetch(1)).toBe('blob:mock-url')
  })

  it('clears prefetch cache on load', () => {
    q.setPrefetch(1, 'blob:mock-url')
    q.load(['new'])
    expect(q.getPrefetch(1)).toBeUndefined()
  })

  it('clearPrefetch removes a single entry', () => {
    q.setPrefetch(1, 'blob:mock-url')
    q.clearPrefetch(1)
    expect(q.getPrefetch(1)).toBeUndefined()
  })

  it('load resets index to 0', () => {
    q.advance()
    q.load(['a', 'b'])
    expect(q.index).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
yarn test test/content/queue.test.ts
```

Expected: FAIL — `Cannot find module '../../src/content/queue'`

- [ ] **Step 3: Implement queue.ts**

```typescript
// src/content/queue.ts
export class Queue {
  private chunks: string[] = []
  private prefetchCache = new Map<number, string>()
  private currentIndex = 0

  load(chunks: string[]): void {
    this.chunks = chunks
    this.currentIndex = 0
    this.prefetchCache.clear()
  }

  current(): string | null {
    return this.chunks[this.currentIndex] ?? null
  }

  peek(index: number): string | null {
    return this.chunks[index] ?? null
  }

  advance(): void {
    this.currentIndex++
  }

  retreat(): void {
    if (this.currentIndex > 0) this.currentIndex--
  }

  get index(): number {
    return this.currentIndex
  }

  get total(): number {
    return this.chunks.length
  }

  setPrefetch(index: number, url: string): void {
    this.prefetchCache.set(index, url)
  }

  getPrefetch(index: number): string | undefined {
    return this.prefetchCache.get(index)
  }

  clearPrefetch(index: number): void {
    this.prefetchCache.delete(index)
  }
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
yarn test test/content/queue.test.ts
```

Expected: PASS — 13 tests pass

- [ ] **Step 5: Run all tests to confirm nothing regressed**

```bash
yarn test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/content/queue.ts test/content/queue.test.ts
git commit -m "feat: add Queue with prefetch cache"
```

---

### Task 6: Readability extractor

**Files:**
- Create: `src/content/extractor/readability.ts`

- [ ] **Step 1: Create src/content/extractor/readability.ts**

```typescript
// src/content/extractor/readability.ts
import { Readability } from '@mozilla/readability'
import type { ExtractionResult, Extractor } from './types'

export class ReadabilityExtractor implements Extractor {
  extract(document: Document): ExtractionResult {
    const clone = document.cloneNode(true) as Document
    const reader = new Readability(clone)
    const article = reader.parse()

    if (!article) {
      return { title: document.title, paragraphs: [] }
    }

    const parsed = new DOMParser().parseFromString(article.content, 'text/html')
    let root: Element | null = parsed.body

    // unwrap single-child wrappers
    while (root && root.children.length === 1) {
      root = root.firstElementChild
    }

    if (!root) {
      return { title: article.title, paragraphs: [] }
    }

    const paragraphs: string[] = []

    if (article.title) {
      paragraphs.push(article.title)
    }

    root.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li:not(:has(> p))').forEach(el => {
      const text = el.textContent?.trim() ?? ''
      if (text) paragraphs.push(text)
    })

    return { title: article.title, paragraphs }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/content/extractor/readability.ts
git commit -m "feat: add ReadabilityExtractor"
```

---

### Task 7: Player

**Files:**
- Create: `src/content/player.ts`

- [ ] **Step 1: Create src/content/player.ts**

```typescript
// src/content/player.ts
import type { PlaybackState } from './types'
import type { Queue } from './queue'
import type { Settings } from './settings'

const PREFETCH_AHEAD = 2

export class Player {
  private audio = new Audio()
  private state: PlaybackState['state'] = 'idle'
  private fetchController: AbortController | null = null

  onStateChange?: (state: PlaybackState) => void

  constructor(
    private readonly queue: Queue,
    private readonly settings: Settings,
  ) {
    this.audio.addEventListener('ended', () => { this.onAudioEnded() })
    this.audio.addEventListener('error', () => {
      this.notify('error', this.audio.error?.message ?? 'Audio playback failed')
    })
  }

  async play(): Promise<void> {
    if (this.state === 'playing') return
    if (this.state === 'paused') {
      await this.audio.play()
      this.notify('playing')
      return
    }
    await this.playCurrentChunk()
  }

  pause(): void {
    if (this.state !== 'playing') return
    this.audio.pause()
    this.notify('paused')
  }

  stop(): void {
    this.fetchController?.abort()
    this.audio.pause()
    this.audio.src = ''
    this.notify('stopped')
  }

  async forward(): Promise<void> {
    const wasPlaying = this.state === 'playing' || this.state === 'paused'
    this.audio.pause()
    this.queue.advance()
    if (wasPlaying) await this.playCurrentChunk()
  }

  async rewind(): Promise<void> {
    const wasPlaying = this.state === 'playing' || this.state === 'paused'
    this.audio.pause()
    this.queue.retreat()
    if (wasPlaying) await this.playCurrentChunk()
  }

  private async playCurrentChunk(): Promise<void> {
    const text = this.queue.current()
    if (text === null) {
      this.notify('stopped')
      return
    }

    this.notify('loading')

    try {
      const url = await this.resolveAudio(text, this.queue.index)
      this.audio.src = url
      this.audio.playbackRate = this.settings.rate
      this.audio.volume = this.settings.volume
      await this.audio.play()
      this.notify('playing')
      this.schedulePrefetch()
    }
    catch (err) {
      if (err instanceof Error && err.name !== 'AbortError') {
        this.notify('error', err.message)
      }
    }
  }

  private async resolveAudio(text: string, index: number): Promise<string> {
    const cached = this.queue.getPrefetch(index)
    if (cached) return cached
    return this.fetchAudio(text)
  }

  private async fetchAudio(text: string): Promise<string> {
    this.fetchController = new AbortController()
    const url = new URL(this.settings.serverUrl)
    url.searchParams.set('text', text)
    const res = await fetch(url.toString(), { signal: this.fetchController.signal })
    if (!res.ok) throw new Error(`TTS server responded with ${res.status}`)
    return URL.createObjectURL(await res.blob())
  }

  private schedulePrefetch(): void {
    for (let i = 1; i <= PREFETCH_AHEAD; i++) {
      const idx = this.queue.index + i
      const text = this.queue.peek(idx)
      if (text && !this.queue.getPrefetch(idx)) {
        this.fetchAudio(text)
          .then(blobUrl => { this.queue.setPrefetch(idx, blobUrl) })
          .catch(() => { /* prefetch failures are silent */ })
      }
    }
  }

  private onAudioEnded(): void {
    const src = this.audio.src
    if (src.startsWith('blob:')) URL.revokeObjectURL(src)
    this.queue.clearPrefetch(this.queue.index)
    this.queue.advance()
    void this.playCurrentChunk()
  }

  private notify(state: PlaybackState['state'], error?: string): void {
    this.state = state
    this.onStateChange?.({
      state,
      chunkIndex: this.queue.index,
      totalChunks: this.queue.total,
      error,
    })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/content/player.ts
git commit -m "feat: add Player with prefetch queue and audio playback"
```

---

### Task 8: Floating UI

**Files:**
- Create: `src/content/ui.ts`

- [ ] **Step 1: Create src/content/ui.ts**

```typescript
// src/content/ui.ts
import type { PlaybackState } from './types'

const HOST_ID = '__readout_controls'

const CSS = `
:host {
  all: initial;
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 2147483647;
}
.bar {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #111;
  color: #fff;
  border-radius: 10px;
  padding: 8px 12px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
  font-family: system-ui, sans-serif;
  font-size: 14px;
  user-select: none;
}
button {
  background: none;
  border: none;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  padding: 2px 4px;
  line-height: 1;
  border-radius: 4px;
}
button:hover { background: rgba(255,255,255,0.12); }
.counter {
  font-size: 11px;
  opacity: 0.6;
  min-width: 40px;
  text-align: center;
}
`

export class FloatingUI {
  private readonly host: HTMLDivElement
  private readonly btnPlay: HTMLButtonElement
  private readonly btnPause: HTMLButtonElement
  private readonly btnStop: HTMLButtonElement
  private readonly btnForward: HTMLButtonElement
  private readonly btnRewind: HTMLButtonElement
  private readonly counter: HTMLSpanElement

  onPlay?: () => void
  onPause?: () => void
  onStop?: () => void
  onForward?: () => void
  onRewind?: () => void

  constructor() {
    this.host = document.createElement('div')
    this.host.id = HOST_ID
    const shadow = this.host.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = CSS

    const bar = document.createElement('div')
    bar.className = 'bar'

    this.btnRewind = this.btn('⏮', () => { this.onRewind?.() })
    this.btnPlay = this.btn('▶', () => { this.onPlay?.() })
    this.btnPause = this.btn('⏸', () => { this.onPause?.() })
    this.btnStop = this.btn('⏹', () => { this.onStop?.() })
    this.btnForward = this.btn('⏭', () => { this.onForward?.() })

    this.counter = document.createElement('span')
    this.counter.className = 'counter'

    bar.append(this.btnRewind, this.btnPlay, this.btnPause, this.btnStop, this.btnForward, this.counter)
    shadow.append(style, bar)
    document.body.appendChild(this.host)

    this.update({ state: 'loading', chunkIndex: 0, totalChunks: 0 })
  }

  update(ps: PlaybackState): void {
    const playing = ps.state === 'playing'
    const active = playing || ps.state === 'paused'
    const loading = ps.state === 'loading'

    this.btnPlay.hidden = playing || loading
    this.btnPause.hidden = !playing
    this.btnStop.hidden = ps.state === 'idle' || ps.state === 'stopped'
    this.btnForward.hidden = !active
    this.btnRewind.hidden = !active

    if (ps.state === 'error') {
      this.counter.textContent = ps.error ?? 'Error'
    }
    else if (ps.totalChunks > 0) {
      this.counter.textContent = `${ps.chunkIndex + 1}/${ps.totalChunks}`
    }
    else {
      this.counter.textContent = ''
    }
  }

  remove(): void {
    this.host.remove()
  }

  private btn(label: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button')
    b.textContent = label
    b.addEventListener('click', onClick)
    return b
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/content/ui.ts
git commit -m "feat: add FloatingUI with Shadow DOM controls"
```

---

### Task 9: Content script bootstrap

**Files:**
- Create: `src/content/index.ts`

- [ ] **Step 1: Create src/content/index.ts**

```typescript
// src/content/index.ts
import browser from 'webextension-polyfill'
import { HOOKS } from './extractor/hooks'
import { ReadabilityExtractor } from './extractor/readability'
import { chunk } from './chunker'
import { Queue } from './queue'
import { Player } from './player'
import { FloatingUI } from './ui'
import { getSettings } from './settings'

type Message = { type: 'play' | 'stop' | 'forward' | 'rewind' | 'play-selection'; text?: string }

let player: Player | null = null
let ui: FloatingUI | null = null

async function start(textOverride?: string): Promise<void> {
  const settings = await getSettings()

  let paragraphs: string[]
  let title: string

  if (textOverride) {
    paragraphs = textOverride.split(/\n{2,}/).map(s => s.trim()).filter(Boolean)
    title = ''
  }
  else {
    const extractor = new ReadabilityExtractor()
    let result = extractor.extract(document)

    const hook = HOOKS.find(h => h.matches(location.href))
    if (hook) result = hook.transform(result, document)

    paragraphs = result.paragraphs
    title = result.title
  }

  const chunks = chunk(paragraphs)

  if (chunks.length === 0) {
    console.warn('[Read Out] No readable content found on this page.')
    return
  }

  const queue = new Queue()
  queue.load(chunks)

  player = new Player(queue, settings)
  ui = new FloatingUI()

  player.onStateChange = (state) => {
    ui?.update(state)
    if (state.state === 'stopped' || state.state === 'error') {
      teardown()
    }
  }

  ui.onPlay = () => { void player?.play() }
  ui.onPause = () => { player?.pause() }
  ui.onStop = () => { player?.stop() }
  ui.onForward = () => { void player?.forward() }
  ui.onRewind = () => { void player?.rewind() }

  console.info(`[Read Out] Starting — "${title}", ${chunks.length} chunks`)
  void player.play()
}

function teardown(): void {
  ui?.remove()
  ui = null
  player = null
}

browser.runtime.onMessage.addListener((raw: unknown): undefined => {
  const message = raw as Message
  switch (message.type) {
    case 'play':
      if (!player) void start()
      else void player.play()
      break
    case 'play-selection':
      if (message.text) void start(message.text)
      break
    case 'stop':
      player?.stop()
      break
    case 'forward':
      void player?.forward()
      break
    case 'rewind':
      void player?.rewind()
      break
  }
  return undefined
})
```

- [ ] **Step 2: Commit**

```bash
git add src/content/index.ts
git commit -m "feat: add content script bootstrap"
```

---

### Task 10: Background script

**Files:**
- Create: `src/background/main.ts`

- [ ] **Step 1: Create src/background/main.ts**

```typescript
// src/background/main.ts
import browser from 'webextension-polyfill'

type ContentMessage = { type: 'play' | 'stop' | 'forward' | 'rewind' | 'play-selection'; text?: string }

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: 'read-selection',
    title: browser.i18n.getMessage('context_read_selection') || 'Read selection',
    contexts: ['selection'],
  })
})

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'read-selection' && tab?.id) {
    void send(tab.id, { type: 'play-selection', text: info.selectionText })
  }
})

browser.action.onClicked.addListener((tab) => {
  if (tab.id) void send(tab.id, { type: 'play' })
})

browser.commands.onCommand.addListener(async (command) => {
  const tab = await getActiveTab()
  if (!tab?.id) return
  if (command === 'play' || command === 'stop' || command === 'forward' || command === 'rewind') {
    void send(tab.id, { type: command })
  }
})

async function getActiveTab(): Promise<browser.Tabs.Tab | undefined> {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })
  return tab
}

async function send(tabId: number, message: ContentMessage): Promise<void> {
  try {
    await browser.tabs.sendMessage(tabId, message)
  }
  catch {
    // Tab may not have the content script yet (e.g. chrome:// pages)
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/background/main.ts
git commit -m "feat: add background script"
```

---

### Task 11: Manifest

**Files:**
- Modify: `src/manifest.ts`

- [ ] **Step 1: Overwrite src/manifest.ts**

```typescript
// src/manifest.ts
import fs from 'fs-extra'
import type { Manifest } from 'webextension-polyfill'
import type PkgType from '../package.json'
import { isDev, isFirefox, r } from '../vite.config'

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
      ? { scripts: ['dist/background/index.mjs'], type: 'module' }
      : { service_worker: './dist/background/index.mjs' },

    options_ui: {
      page: './dist/options/index.html',
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
        ? "script-src 'self' 'unsafe-eval'; object-src 'self'"
        : "script-src 'self'; object-src 'self'",
    },

    browser_specific_settings: {
      gecko: {
        id: '{acc6d7a2-f165-4019-9fba-0b72cfeed277}',
        strict_min_version: '110.0',
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
```

- [ ] **Step 2: Overwrite scripts/manifest.ts** — remove the `~/utils` import (the `log` helper came from `src/extension/utils` which no longer exists)

```typescript
// scripts/manifest.ts
import fs from 'fs-extra'
import { getManifest } from '~/manifest'
import { r } from '../vite.config'

export async function writeManifest() {
  await fs.writeJSON(r('extension/manifest.json'), await getManifest(), { spaces: 2 })
  console.log('[PRE] write manifest.json')
}

void writeManifest()
```

- [ ] **Step 3: Overwrite scripts/prepare.ts** — remove `chokidar` (removed from deps) and the `src/extension/manifest.ts` watch path

```typescript
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
```

- [ ] **Step 4: Commit**

```bash
git add src/manifest.ts scripts/manifest.ts scripts/prepare.ts
git commit -m "feat: update manifest — remove iframe resources, add action.onClicked"
```

---

### Task 12: Options page

**Files:**
- Create: `src/options/index.html`
- Create: `src/options/main.ts`

- [ ] **Step 1: Create src/options/index.html**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Read Out — Settings</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 480px; margin: 40px auto; padding: 0 16px; }
    h1 { font-size: 1.2rem; margin-bottom: 24px; }
    label { display: block; margin-bottom: 16px; }
    label span { display: block; font-size: 0.85rem; color: #555; margin-bottom: 4px; }
    input, select { width: 100%; padding: 6px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; box-sizing: border-box; }
    button { margin-top: 24px; padding: 8px 20px; background: #1a1a1a; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; }
    button:hover { opacity: 0.85; }
    #saved { margin-top: 12px; font-size: 0.85rem; color: green; visibility: hidden; }
  </style>
</head>
<body>
  <h1>Read Out Settings</h1>
  <form id="form">
    <label>
      <span>TTS server URL</span>
      <input id="serverUrl" type="url" placeholder="http://localhost:5000" />
    </label>
    <label>
      <span>Extractor</span>
      <select id="extractor">
        <option value="readability">Readability (default)</option>
      </select>
    </label>
    <label>
      <span>Playback rate (<span id="rateVal">1.0</span>×)</span>
      <input id="rate" type="range" min="0.5" max="3" step="0.1" />
    </label>
    <label>
      <span>Volume (<span id="volumeVal">100</span>%)</span>
      <input id="volume" type="range" min="0" max="1" step="0.05" />
    </label>
    <button type="submit">Save</button>
    <p id="saved">Settings saved.</p>
  </form>
  <script type="module" src="./main.ts"></script>
</body>
</html>
```

- [ ] **Step 2: Create src/options/main.ts**

```typescript
// src/options/main.ts
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '~/content/settings'

const form = document.getElementById('form') as HTMLFormElement
const serverUrlInput = document.getElementById('serverUrl') as HTMLInputElement
const extractorSelect = document.getElementById('extractor') as HTMLSelectElement
const rateInput = document.getElementById('rate') as HTMLInputElement
const rateVal = document.getElementById('rateVal') as HTMLSpanElement
const volumeInput = document.getElementById('volume') as HTMLInputElement
const volumeVal = document.getElementById('volumeVal') as HTMLSpanElement
const savedMsg = document.getElementById('saved') as HTMLParagraphElement

async function load(): Promise<void> {
  const s = await getSettings()
  serverUrlInput.value = s.serverUrl
  extractorSelect.value = s.extractor
  rateInput.value = String(s.rate)
  rateVal.textContent = s.rate.toFixed(1)
  volumeInput.value = String(s.volume)
  volumeVal.textContent = String(Math.round(s.volume * 100))
}

rateInput.addEventListener('input', () => {
  rateVal.textContent = Number(rateInput.value).toFixed(1)
})

volumeInput.addEventListener('input', () => {
  volumeVal.textContent = String(Math.round(Number(volumeInput.value) * 100))
})

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  await saveSettings({
    serverUrl: serverUrlInput.value || DEFAULT_SETTINGS.serverUrl,
    extractor: extractorSelect.value as 'readability',
    rate: Number(rateInput.value),
    volume: Number(volumeInput.value),
  })
  savedMsg.style.visibility = 'visible'
  setTimeout(() => { savedMsg.style.visibility = 'hidden' }, 2000)
})

void load()
```

- [ ] **Step 3: Commit**

```bash
git add src/options/index.html src/options/main.ts
git commit -m "feat: add options settings page"
```

---

### Task 13: Build verification

**Files:** none created — verification only

- [ ] **Step 1: Run the full test suite**

```bash
yarn test
```

Expected: all tests pass

- [ ] **Step 2: Run typecheck**

```bash
yarn typecheck
```

Expected: no errors

- [ ] **Step 3: Run lint**

```bash
yarn lint
```

Expected: no errors (fix any that appear before continuing)

- [ ] **Step 4: Run production build**

```bash
yarn build
```

Expected: exits 0. Verify the following files exist:
```
extension/dist/background/index.mjs
extension/dist/contentScripts/index.global.js
extension/dist/options/index.html
extension/manifest.json
```

- [ ] **Step 5: Load the extension in Chrome**

1. Open `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" → select the `extension/` folder
4. Navigate to any article page (e.g. a Wikipedia article)
5. Press `Alt+P` — floating controls should appear and audio should start playing from the local TTS server
6. Test pause (`Alt+P` again), stop (`Alt+O`), forward (`Alt+.`), rewind (`Alt+,`)

- [ ] **Step 6: Verify Firefox build**

```bash
yarn build:firefox
```

Expected: exits 0. `extension/manifest.json` should contain `background.scripts` (not `background.service_worker`).

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "chore: verify build outputs and browser loading"
```

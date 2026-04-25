# Floating UI v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapsible text preview panel (sentences highlighted, clickable to seek), an inline settings panel, SVG icons, larger sizing, and remove the sentence counter from the Read Out floating controls.

**Architecture:** Six sequential tasks building on each other — types and settings first, then the two data modules (chunker, queue), then player methods, then the UI rewrite, then wiring everything in the bootstrap. Each task is independently committable and passes the full test suite before the next begins.

**Tech Stack:** TypeScript, Vitest, Shadow DOM, browser.storage.local via webextension-polyfill

---

## File Map

| File | Action | Notes |
|---|---|---|
| `src/content/types.ts` | Modify | Add `SentenceChunk`, `ParagraphGroup` |
| `src/content/settings.ts` | Modify | Add `showPreview: boolean` |
| `src/content/chunker.ts` | Modify | Add `chunkIntoGroups()`; rewrite `chunk()` on top |
| `src/content/queue.ts` | Modify | Add `seekTo(index)` |
| `src/content/player.ts` | Modify | Add `seekTo()`, `updateRate()`, `updateVolume()` |
| `src/content/ui.ts` | Rewrite | Preview panel, settings panel, SVG icons |
| `src/content/index.ts` | Modify | Use `chunkIntoGroups`, wire new UI callbacks |
| `test/content/chunker.test.ts` | Modify | Add tests for `chunkIntoGroups` |
| `test/content/queue.test.ts` | Modify | Add tests for `seekTo` |

---

### Task 1: Types and settings

**Files:**
- Modify: `src/content/types.ts`
- Modify: `src/content/settings.ts`

- [ ] **Step 1: Add `SentenceChunk` and `ParagraphGroup` to `src/content/types.ts`**

```typescript
// src/content/types.ts
export type PlaybackState = {
  state: 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error'
  chunkIndex: number
  totalChunks: number
  error?: string
}

export type SentenceChunk = { index: number; text: string }
export type ParagraphGroup = { sentences: SentenceChunk[] }
```

- [ ] **Step 2: Add `showPreview` to `src/content/settings.ts`**

```typescript
// src/content/settings.ts
import browser from 'webextension-polyfill'

export type Settings = {
  serverUrl: string
  extractor: 'readability'
  rate: number
  volume: number
  showPreview: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  serverUrl: 'http://localhost:5000',
  extractor: 'readability',
  rate: 1.0,
  volume: 1.0,
  showPreview: true,
}

export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(Object.keys(DEFAULT_SETTINGS))
  return { ...DEFAULT_SETTINGS, ...(stored as Partial<Settings>) }
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  await browser.storage.local.set(settings)
}
```

- [ ] **Step 3: Run typecheck to confirm no errors in `src/`**

```bash
yarn typecheck 2>&1 | grep "src/"
```

Expected: no output (no errors in `src/`)

- [ ] **Step 4: Commit**

```bash
git add src/content/types.ts src/content/settings.ts
git commit -m "feat: add SentenceChunk, ParagraphGroup types; add showPreview setting"
```

---

### Task 2: Chunker — add `chunkIntoGroups` (TDD)

**Files:**
- Modify: `test/content/chunker.test.ts`
- Modify: `src/content/chunker.ts`

- [ ] **Step 1: Add failing tests for `chunkIntoGroups` to `test/content/chunker.test.ts`**

Add these imports and test cases below the existing `chunk` tests:

```typescript
import { describe, expect, it } from 'vitest'
import { chunk, chunkIntoGroups } from '../../src/content/chunker'

// ... existing chunk tests unchanged ...

describe('chunkIntoGroups', () => {
  it('returns one group per paragraph with flat indices starting at 0', () => {
    const result = chunkIntoGroups(['Hello world. How are you?'])
    expect(result).toEqual([
      {
        sentences: [
          { index: 0, text: 'Hello world.' },
          { index: 1, text: 'How are you?' },
        ],
      },
    ])
  })

  it('indices are contiguous across multiple paragraphs', () => {
    const result = chunkIntoGroups(['First.', 'Second. Third.'])
    expect(result).toEqual([
      { sentences: [{ index: 0, text: 'First.' }] },
      {
        sentences: [
          { index: 1, text: 'Second.' },
          { index: 2, text: 'Third.' },
        ],
      },
    ])
  })

  it('drops empty paragraphs', () => {
    const result = chunkIntoGroups(['', 'Hello.', ''])
    expect(result).toEqual([
      { sentences: [{ index: 0, text: 'Hello.' }] },
    ])
  })

  it('returns empty array for empty input', () => {
    expect(chunkIntoGroups([])).toEqual([])
  })

  it('chunk() produces the same flat list as chunkIntoGroups() flattened', () => {
    const paragraphs = ['First sentence. Second sentence.', 'Third sentence.']
    const flat = chunkIntoGroups(paragraphs).flatMap(g => g.sentences.map(s => s.text))
    expect(flat).toEqual(chunk(paragraphs))
  })
})
```

- [ ] **Step 2: Run the new tests to confirm they fail**

```bash
npx vitest run test/content/chunker.test.ts 2>&1 | tail -20
```

Expected: failures mentioning `chunkIntoGroups is not a function`

- [ ] **Step 3: Implement `chunkIntoGroups` and rewrite `chunk` in `src/content/chunker.ts`**

```typescript
// src/content/chunker.ts
import type { ParagraphGroup } from './types'

const SENTENCE_BOUNDARY = /(?<=[.?!])\s+/

export function chunkIntoGroups(paragraphs: string[]): ParagraphGroup[] {
  const groups: ParagraphGroup[] = []
  let flatIndex = 0
  for (const paragraph of paragraphs) {
    const sentences = paragraph
      .split(SENTENCE_BOUNDARY)
      .map(s => s.trim())
      .filter(s => s.length > 0)
    if (sentences.length === 0) continue
    groups.push({
      sentences: sentences.map(text => ({ index: flatIndex++, text })),
    })
  }
  return groups
}

export function chunk(paragraphs: string[]): string[] {
  return chunkIntoGroups(paragraphs).flatMap(g => g.sentences.map(s => s.text))
}
```

- [ ] **Step 4: Run all tests to confirm they pass**

```bash
npx vitest run 2>&1 | tail -5
```

Expected: `PASS (X) FAIL (0)` — all existing tests plus the new `chunkIntoGroups` tests pass

- [ ] **Step 5: Commit**

```bash
git add src/content/chunker.ts test/content/chunker.test.ts
git commit -m "feat: add chunkIntoGroups; rewrite chunk() on top of it"
```

---

### Task 3: Queue — add `seekTo` (TDD)

**Files:**
- Modify: `test/content/queue.test.ts`
- Modify: `src/content/queue.ts`

- [ ] **Step 1: Add failing tests for `seekTo` to `test/content/queue.test.ts`**

Add these cases inside the existing `describe('Queue', ...)` block, after the existing tests:

```typescript
  it('seekTo moves to the given index', () => {
    q.seekTo(2)
    expect(q.index).toBe(2)
    expect(q.current()).toBe('chunk 3')
  })

  it('seekTo clamps negative index to 0', () => {
    q.seekTo(-5)
    expect(q.index).toBe(0)
  })

  it('seekTo clamps index beyond total to last valid index', () => {
    q.seekTo(99)
    expect(q.index).toBe(2)
  })

  it('seekTo clears the entire prefetch cache', () => {
    q.setPrefetch(0, 'blob:a')
    q.setPrefetch(1, 'blob:b')
    q.setPrefetch(2, 'blob:c')
    q.seekTo(1)
    expect(q.getPrefetch(0)).toBeUndefined()
    expect(q.getPrefetch(1)).toBeUndefined()
    expect(q.getPrefetch(2)).toBeUndefined()
  })

  it('seekTo does nothing on empty queue', () => {
    const empty = new Queue()
    expect(() => { empty.seekTo(0) }).not.toThrow()
    expect(empty.index).toBe(0)
  })
```

- [ ] **Step 2: Run new tests to confirm they fail**

```bash
npx vitest run test/content/queue.test.ts 2>&1 | tail -20
```

Expected: failures mentioning `seekTo is not a function`

- [ ] **Step 3: Implement `seekTo` in `src/content/queue.ts`**

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

  seekTo(index: number): void {
    if (this.chunks.length === 0) return
    this.currentIndex = Math.max(0, Math.min(index, this.chunks.length - 1))
    for (const url of this.prefetchCache.values()) {
      URL.revokeObjectURL(url)
    }
    this.prefetchCache.clear()
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

- [ ] **Step 4: Run all tests**

```bash
npx vitest run 2>&1 | tail -5
```

Expected: `PASS (X) FAIL (0)`

- [ ] **Step 5: Commit**

```bash
git add src/content/queue.ts test/content/queue.test.ts
git commit -m "feat: add Queue.seekTo with prefetch cache revocation"
```

---

### Task 4: Player — add `seekTo`, `updateRate`, `updateVolume`

**Files:**
- Modify: `src/content/player.ts`

- [ ] **Step 1: Add the three public methods to `src/content/player.ts`**

Add these methods after the existing `rewind()` method (before `private async playCurrentChunk`):

```typescript
  async seekTo(index: number): Promise<void> {
    this.fetchController?.abort()
    this.audio.pause()
    if (this.audio.src.startsWith('blob:')) URL.revokeObjectURL(this.audio.src)
    this.audio.src = ''
    this.queue.seekTo(index)
    await this.playCurrentChunk()
  }

  updateRate(rate: number): void {
    this.settings.rate = rate
    this.audio.playbackRate = rate
  }

  updateVolume(volume: number): void {
    this.settings.volume = volume
    this.audio.volume = volume
  }
```

- [ ] **Step 2: Run typecheck**

```bash
yarn typecheck 2>&1 | grep "src/"
```

Expected: no output

- [ ] **Step 3: Run all tests**

```bash
npx vitest run 2>&1 | tail -5
```

Expected: `PASS (X) FAIL (0)`

- [ ] **Step 4: Commit**

```bash
git add src/content/player.ts
git commit -m "feat: add Player.seekTo, updateRate, updateVolume"
```

---

### Task 5: Floating UI v2

**Files:**
- Rewrite: `src/content/ui.ts`

- [ ] **Step 1: Overwrite `src/content/ui.ts` with the following**

```typescript
// src/content/ui.ts
import type { PlaybackState, ParagraphGroup } from './types'
import type { Settings } from './settings'

const HOST_ID = '__readout_controls'

const SVG_REWIND = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>`
const SVG_PLAY = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`
const SVG_PAUSE = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`
const SVG_STOP = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h12v12H6z"/></svg>`
const SVG_FORWARD = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>`
const SVG_PREVIEW = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/></svg>`
const SVG_SETTINGS = `<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>`

const CSS = `
[hidden] { display: none !important; }

:host {
  all: initial;
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 2147483647;
}
.container {
  display: flex;
  flex-direction: column;
  width: 320px;
  background: #111;
  color: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.5);
  font-family: system-ui, sans-serif;
  user-select: none;
  overflow: hidden;
}
.preview {
  max-height: 200px;
  overflow-y: auto;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.1);
}
.preview::-webkit-scrollbar { width: 4px; }
.preview::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 2px; }
.paragraph {
  margin: 0 0 10px;
  font-size: 14px;
  line-height: 1.6;
}
.paragraph:last-child { margin-bottom: 0; }
.sentence {
  display: inline;
  cursor: pointer;
  border-radius: 3px;
}
.sentence:hover { opacity: 0.7; }
.sentence.active { background: rgba(255,220,0,0.35); }
.bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 10px 14px;
}
.btn {
  background: none;
  border: none;
  color: #fff;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 6px;
  flex-shrink: 0;
  padding: 0;
}
.btn:hover { background: rgba(255,255,255,0.12); }
.btn svg { display: block; }
.settings-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border-top: 1px solid rgba(255,255,255,0.1);
  font-size: 13px;
}
.setting-label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.setting-label > span {
  font-size: 11px;
  opacity: 0.6;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.setting-label input[type="url"],
.setting-label select {
  background: rgba(255,255,255,0.1);
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 4px;
  color: #fff;
  font-size: 13px;
  padding: 5px 8px;
  width: 100%;
  box-sizing: border-box;
}
.range-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.range-row > span:first-child {
  font-size: 11px;
  opacity: 0.6;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  min-width: 52px;
}
.range-row input[type="range"] { flex: 1; accent-color: #ffd700; }
.range-val { font-size: 12px; min-width: 40px; text-align: right; opacity: 0.85; }
`

export class FloatingUI {
  private readonly host: HTMLDivElement
  private readonly previewEl: HTMLDivElement
  private readonly btnPlay: HTMLButtonElement
  private readonly btnPause: HTMLButtonElement
  private readonly btnStop: HTMLButtonElement
  private readonly btnForward: HTMLButtonElement
  private readonly btnRewind: HTMLButtonElement
  private readonly settingsPanel: HTMLDivElement
  private readonly inputServerUrl: HTMLInputElement
  private readonly selectExtractor: HTMLSelectElement
  private readonly inputRate: HTMLInputElement
  private readonly inputVolume: HTMLInputElement
  private readonly spanRateVal: HTMLSpanElement
  private readonly spanVolumeVal: HTMLSpanElement

  private sentenceMap = new Map<number, HTMLElement>()
  private activeIndex = -1
  private previewOpen = true
  private settingsOpen = false

  onPlay?: () => void
  onPause?: () => void
  onStop?: () => void
  onForward?: () => void
  onRewind?: () => void
  onSeekTo?: (index: number) => void
  onSettingsChange?: (partial: Partial<Settings>) => void

  constructor() {
    this.host = document.createElement('div')
    this.host.id = HOST_ID
    const shadow = this.host.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = CSS

    const container = document.createElement('div')
    container.className = 'container'

    // Preview panel (populated later by loadChunks)
    this.previewEl = document.createElement('div')
    this.previewEl.className = 'preview'
    this.previewEl.hidden = false

    // Button bar
    const bar = document.createElement('div')
    bar.className = 'bar'

    this.btnRewind = this.btn(SVG_REWIND, () => { this.onRewind?.() })
    this.btnPlay = this.btn(SVG_PLAY, () => { this.onPlay?.() })
    this.btnPause = this.btn(SVG_PAUSE, () => { this.onPause?.() })
    this.btnStop = this.btn(SVG_STOP, () => { this.onStop?.() })
    this.btnForward = this.btn(SVG_FORWARD, () => { this.onForward?.() })

    const btnTogglePreview = this.btn(SVG_PREVIEW, () => { this.togglePreview() })
    const btnSettings = this.btn(SVG_SETTINGS, () => { this.toggleSettings() })

    bar.append(
      this.btnRewind, this.btnPlay, this.btnPause, this.btnStop, this.btnForward,
      btnTogglePreview, btnSettings,
    )

    // Settings panel (populated in constructor; shown on demand)
    this.settingsPanel = document.createElement('div')
    this.settingsPanel.className = 'settings-panel'
    this.settingsPanel.hidden = true

    this.inputServerUrl = document.createElement('input')
    this.inputServerUrl.type = 'url'
    this.inputServerUrl.addEventListener('change', () => {
      this.onSettingsChange?.({ serverUrl: this.inputServerUrl.value })
    })

    this.selectExtractor = document.createElement('select')
    const opt = document.createElement('option')
    opt.value = 'readability'
    opt.textContent = 'Readability (default)'
    this.selectExtractor.appendChild(opt)
    this.selectExtractor.addEventListener('change', () => {
      this.onSettingsChange?.({ extractor: this.selectExtractor.value as 'readability' })
    })

    this.inputRate = document.createElement('input')
    this.inputRate.type = 'range'
    this.inputRate.min = '1'
    this.inputRate.max = '3'
    this.inputRate.step = '0.25'
    this.spanRateVal = document.createElement('span')
    this.spanRateVal.className = 'range-val'
    this.inputRate.addEventListener('input', () => {
      const val = Number(this.inputRate.value)
      this.spanRateVal.textContent = `${val.toFixed(2)}×`
      this.onSettingsChange?.({ rate: val })
    })

    this.inputVolume = document.createElement('input')
    this.inputVolume.type = 'range'
    this.inputVolume.min = '0'
    this.inputVolume.max = '1'
    this.inputVolume.step = '0.05'
    this.spanVolumeVal = document.createElement('span')
    this.spanVolumeVal.className = 'range-val'
    this.inputVolume.addEventListener('input', () => {
      const val = Number(this.inputVolume.value)
      this.spanVolumeVal.textContent = `${Math.round(val * 100)}%`
      this.onSettingsChange?.({ volume: val })
    })

    this.settingsPanel.append(
      this.settingLabel('Server URL', this.inputServerUrl),
      this.settingLabel('Extractor', this.selectExtractor),
      this.rangeRow('Rate', this.inputRate, this.spanRateVal),
      this.rangeRow('Volume', this.inputVolume, this.spanVolumeVal),
    )

    container.append(this.previewEl, bar, this.settingsPanel)
    shadow.append(style, container)
    document.body.appendChild(this.host)

    this.update({ state: 'loading', chunkIndex: 0, totalChunks: 0 })
  }

  loadChunks(groups: ParagraphGroup[], settings: Settings): void {
    this.sentenceMap.clear()
    this.activeIndex = -1
    this.previewEl.innerHTML = ''

    for (const group of groups) {
      const paraEl = document.createElement('div')
      paraEl.className = 'paragraph'
      for (const { index, text } of group.sentences) {
        const span = document.createElement('span')
        span.className = 'sentence'
        span.textContent = text + ' '
        span.dataset.index = String(index)
        span.addEventListener('click', () => { this.onSeekTo?.(index) })
        paraEl.appendChild(span)
        this.sentenceMap.set(index, span)
      }
      this.previewEl.appendChild(paraEl)
    }

    // Populate settings inputs with current values
    this.inputServerUrl.value = settings.serverUrl
    this.selectExtractor.value = settings.extractor
    this.inputRate.value = String(settings.rate)
    this.spanRateVal.textContent = `${settings.rate.toFixed(2)}×`
    this.inputVolume.value = String(settings.volume)
    this.spanVolumeVal.textContent = `${Math.round(settings.volume * 100)}%`

    this.previewOpen = settings.showPreview
    this.previewEl.hidden = !this.previewOpen
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

    if (ps.chunkIndex !== this.activeIndex) {
      this.sentenceMap.get(this.activeIndex)?.classList.remove('active')
      this.sentenceMap.get(ps.chunkIndex)?.classList.add('active')
      this.sentenceMap.get(ps.chunkIndex)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      this.activeIndex = ps.chunkIndex
    }
  }

  remove(): void {
    this.host.remove()
  }

  private togglePreview(): void {
    this.previewOpen = !this.previewOpen
    this.previewEl.hidden = !this.previewOpen
  }

  private toggleSettings(): void {
    this.settingsOpen = !this.settingsOpen
    this.settingsPanel.hidden = !this.settingsOpen
  }

  private btn(svg: string, onClick: () => void): HTMLButtonElement {
    const b = document.createElement('button')
    b.className = 'btn'
    b.innerHTML = svg
    b.addEventListener('click', onClick)
    return b
  }

  private settingLabel(labelText: string, input: HTMLElement): HTMLDivElement {
    const div = document.createElement('div')
    div.className = 'setting-label'
    const span = document.createElement('span')
    span.textContent = labelText
    div.append(span, input)
    return div
  }

  private rangeRow(labelText: string, input: HTMLInputElement, valSpan: HTMLSpanElement): HTMLDivElement {
    const div = document.createElement('div')
    div.className = 'range-row'
    const label = document.createElement('span')
    label.textContent = labelText
    div.append(label, input, valSpan)
    return div
  }
}
```

- [ ] **Step 2: Run typecheck**

```bash
yarn typecheck 2>&1 | grep "src/"
```

Expected: no output

- [ ] **Step 3: Run lint**

```bash
yarn lint 2>&1 | grep -v "ESLintIgnoreWarning\|node:.*trace\|Done in"
```

Expected: no errors

- [ ] **Step 4: Run all tests**

```bash
npx vitest run 2>&1 | tail -5
```

Expected: `PASS (X) FAIL (0)`

- [ ] **Step 5: Commit**

```bash
git add src/content/ui.ts
git commit -m "feat: floating UI v2 — preview panel, settings panel, SVG icons, larger sizing"
```

---

### Task 6: Wire everything in bootstrap

**Files:**
- Modify: `src/content/index.ts`

- [ ] **Step 1: Overwrite `src/content/index.ts`**

```typescript
// src/content/index.ts
import browser from 'webextension-polyfill'
import { HOOKS } from './extractor/hooks'
import { ReadabilityExtractor } from './extractor/readability'
import { chunkIntoGroups } from './chunker'
import { Queue } from './queue'
import { Player } from './player'
import { FloatingUI } from './ui'
import { getSettings, saveSettings } from './settings'

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

  const groups = chunkIntoGroups(paragraphs)
  const flatChunks = groups.flatMap(g => g.sentences.map(s => s.text))

  if (flatChunks.length === 0) {
    console.warn('[Read Out] No readable content found on this page.')
    return
  }

  const queue = new Queue()
  queue.load(flatChunks)

  player = new Player(queue, settings)
  ui = new FloatingUI()
  ui.loadChunks(groups, settings)

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
  ui.onSeekTo = (index) => { void player?.seekTo(index) }
  ui.onSettingsChange = async (partial) => {
    await saveSettings(partial)
    if (partial.rate !== undefined) player?.updateRate(partial.rate)
    if (partial.volume !== undefined) player?.updateVolume(partial.volume)
  }

  console.info(`[Read Out] Starting — "${title}", ${flatChunks.length} chunks`)
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
      else if (player.isPlaying) player.pause()
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

- [ ] **Step 2: Run typecheck**

```bash
yarn typecheck 2>&1 | grep "src/"
```

Expected: no output

- [ ] **Step 3: Run lint**

```bash
yarn lint 2>&1 | grep -v "ESLintIgnoreWarning\|node:.*trace\|Done in"
```

Expected: no errors

- [ ] **Step 4: Run all tests**

```bash
npx vitest run 2>&1 | tail -5
```

Expected: `PASS (X) FAIL (0)`

- [ ] **Step 5: Run production build**

```bash
yarn build 2>&1 | grep -E "✓|error|Error" | grep -v CJS
```

Expected: three `✓ built in` lines, no errors

- [ ] **Step 6: Commit**

```bash
git add src/content/index.ts
git commit -m "feat: wire preview panel, seek, and live settings into bootstrap"
```

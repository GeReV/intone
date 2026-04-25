# Floating UI v2 — Design Spec

**Date:** 2026-04-25
**Status:** Approved

## Overview

Enhance the floating controls with a text preview panel (collapsible, sentences highlighted and clickable), an inline settings panel, SVG icons, and larger sizing. Remove the sentence counter.

## Requirements

- Collapsible text preview panel above the button bar; expanded by default (configurable via `showPreview` setting)
- Preview shows all sentences grouped by paragraph; sentences are `display: inline` within paragraphs so they flow naturally
- Active sentence is highlighted; clicking any sentence seeks to it and starts playing immediately
- Collapsible settings panel below the button bar, toggled by a gear button
- Settings panel contains all four settings (serverUrl, extractor, rate, volume); changes take effect immediately
- Rate: range 1–3, step 0.25; Volume: range 0–1, step 0.05; both update playback live
- serverUrl and extractor: saved to storage, take effect on next play
- SVG icons (24×24, `currentColor`) replace emoji text on all buttons
- Buttons 36×36px, base font 16px — larger than current
- Sentence/chunk counter removed

## Out of Scope

- Word-level highlighting
- Animated panel transitions
- Multiple simultaneous sessions

---

## Architecture

### Changed files

| File | Change |
|---|---|
| `src/content/types.ts` | Add `SentenceChunk`, `ParagraphGroup` |
| `src/content/settings.ts` | Add `showPreview: boolean` (default `true`) |
| `src/content/chunker.ts` | Add `chunkIntoGroups()`; rewrite `chunk()` on top of it |
| `src/content/queue.ts` | Add `seekTo(index)` |
| `src/content/player.ts` | Add `seekTo()`, `updateRate()`, `updateVolume()` |
| `src/content/ui.ts` | Full rewrite — preview panel, settings panel, SVG icons |
| `src/content/index.ts` | Pass `ParagraphGroup[]` to UI; wire `onSeekTo`, `onSettingsChange` |
| `test/content/chunker.test.ts` | Tests for `chunkIntoGroups` |
| `test/content/queue.test.ts` | Tests for `seekTo` |

---

## Types

```typescript
// src/content/types.ts additions
type SentenceChunk = { index: number; text: string }
type ParagraphGroup = { sentences: SentenceChunk[] }
```

`index` is the position of the sentence in the flat playback queue.

---

## Settings

```typescript
interface Settings {
  serverUrl: string       // default: "http://localhost:5000"
  extractor: 'readability'
  rate: number            // default: 1.0
  volume: number          // default: 1.0
  showPreview: boolean    // default: true
}
```

---

## Chunker

`chunkIntoGroups(paragraphs: string[]): ParagraphGroup[]`

Splits each paragraph at sentence boundaries (existing `SENTENCE_BOUNDARY` regex), assigns a monotonically-increasing flat `index` to each sentence across all paragraphs, and returns one `ParagraphGroup` per input paragraph. Empty paragraphs (zero sentences after splitting) are dropped.

`chunk(paragraphs: string[]): string[]` becomes:

```typescript
export function chunk(paragraphs: string[]): string[] {
  return chunkIntoGroups(paragraphs).flatMap(g => g.sentences.map(s => s.text))
}
```

---

## Queue

New method:

```typescript
seekTo(index: number): void
```

Clamps `index` to `[0, total - 1]`. Sets `currentIndex` to the clamped value. Iterates the entire prefetch cache, calls `URL.revokeObjectURL` on every stored blob URL, then clears the map — the jump may land far from the previous position so all cached audio is stale.

---

## Player

Three new public methods:

```typescript
seekTo(index: number): Promise<void>
```
Aborts any in-flight fetch. Revokes and clears the current `audio.src` blob. Calls `queue.seekTo(index)`. Calls `playCurrentChunk()`.

```typescript
updateRate(rate: number): void
```
Sets `this.audio.playbackRate = rate`. Updates `this.settings.rate = rate` so subsequent `playCurrentChunk` calls use the new value.

```typescript
updateVolume(volume: number): void
```
Sets `this.audio.volume = volume`. Updates `this.settings.volume = volume`.

---

## Floating UI

### DOM structure (inside Shadow DOM)

```
<div class="container">
  <div class="preview">            ← shown when previewOpen && chunks loaded
    <div class="paragraph">
      <span class="sentence [active]" data-index="N">text</span>
      <span class="sentence" data-index="N+1">text</span>
      …
    </div>
    …
  </div>

  <div class="bar">
    <button class="btn" id="btnRewind">  <!-- SVG -->
    <button class="btn" id="btnPlay">
    <button class="btn" id="btnPause">
    <button class="btn" id="btnStop">
    <button class="btn" id="btnForward">
    <button class="btn" id="btnTogglePreview">  <!-- ≡ -->
    <button class="btn" id="btnSettings">       <!-- ⚙ -->
  </div>

  <div class="settings-panel">     ← shown when settingsOpen
    <label>Server URL <input type="url" /></label>
    <label>Extractor <select>…</select></label>
    <label>Rate <span class="val">1.0×</span> <input type="range" /></label>
    <label>Volume <span class="val">100%</span> <input type="range" /></label>
  </div>
</div>
```

### CSS highlights

- `.container` — `display: flex; flex-direction: column; width: 320px`
- `.preview` — `max-height: 200px; overflow-y: auto; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.1)`
- `.paragraph` — `margin-bottom: 8px; font-size: 14px; line-height: 1.5`
- `.sentence` — `display: inline; cursor: pointer`
- `.sentence:hover` — subtle lighter text
- `.sentence.active` — `background: rgba(255, 220, 0, 0.35); border-radius: 3px`
- `.bar` — existing style, updated to `font-size: 16px; padding: 10px 14px`
- `.btn` — `width: 36px; height: 36px; display: flex; align-items: center; justify-content: center`
- `.settings-panel` — `padding: 10px 14px; border-top: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; gap: 10px; font-size: 13px`

### Public interface changes

```typescript
class FloatingUI {
  // Call once after session starts; also accepts current settings to populate the panel
  loadChunks(groups: ParagraphGroup[], settings: Settings): void

  // Existing — now also scrolls active sentence into view; no longer updates counter
  update(ps: PlaybackState): void

  // New callbacks
  onSeekTo?: (index: number) => void
  onSettingsChange?: (partial: Partial<Settings>) => void

  // Existing callbacks unchanged
  onPlay?: () => void
  onPause?: () => void
  onStop?: () => void
  onForward?: () => void
  onRewind?: () => void

  remove(): void
}
```

### Behaviour details

- `loadChunks` renders the preview DOM, stores sentence elements in a `Map<number, HTMLElement>` for O(1) lookup in `update`. It also receives the current `Settings` object: `showPreview` controls the initial `previewOpen` state, and the four setting values pre-populate the settings panel inputs. The preview toggle button always works regardless of the initial `previewOpen` value.
- `update` finds the element at `ps.chunkIndex`, removes `active` from the previous element, adds it to the new one, calls `scrollIntoView({ block: 'nearest', behavior: 'smooth' })`.
- Sentence click calls `onSeekTo(index)` — always plays immediately regardless of prior state.
- Settings inputs wire on `input` (ranges) or `change` (text/select) and fire `onSettingsChange` with only the changed key.
- Preview toggle button flips a local `previewOpen` boolean and shows/hides `.preview` via `hidden`.
- Settings toggle button flips `settingsOpen` and shows/hides `.settings-panel` via `hidden`.

### SVG icon strings (inline, 24×24 viewBox)

All paths use `fill="currentColor"` or `stroke="currentColor"`.

| Button | Icon description |
|---|---|
| Rewind | Vertical bar + left-pointing filled triangle |
| Play | Right-pointing filled triangle |
| Pause | Two vertical filled rectangles |
| Stop | Filled square |
| Forward | Right-pointing filled triangle + vertical bar |
| Preview toggle | Three horizontal lines (hamburger) |
| Settings | Outlined circle with 8 gear teeth |

---

## Data flow in `index.ts`

```typescript
// After chunks are computed:
const groups = chunkIntoGroups(paragraphs)
const flatChunks = groups.flatMap(g => g.sentences.map(s => s.text))

queue.load(flatChunks)
ui.loadChunks(groups, settings)

// New callbacks:
ui.onSeekTo = (index) => { void player.seekTo(index) }
ui.onSettingsChange = async (partial) => {
  await saveSettings(partial)
  if (partial.rate !== undefined) player.updateRate(partial.rate)
  if (partial.volume !== undefined) player.updateVolume(partial.volume)
}
```

---

## Testing

**`test/content/chunker.test.ts`** — new tests for `chunkIntoGroups`:
- Single paragraph → one group with correct sentence texts and indices starting at 0
- Multiple paragraphs → indices are contiguous across groups
- Empty paragraph → dropped (not present in output)
- Existing `chunk()` tests continue to pass (behaviour unchanged)

**`test/content/queue.test.ts`** — new tests for `seekTo`:
- `seekTo(0)` on non-empty queue → index is 0
- `seekTo(total - 1)` → index is last valid
- `seekTo(-1)` → clamped to 0
- `seekTo(total)` → clamped to `total - 1`
- `seekTo` clears the prefetch cache (verify via `getPrefetch`)

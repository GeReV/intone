# Engine Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GET /engines` to the server, add engine + voice selectors to the options page and floating UI settings panel, and fix two options page bugs (missing `showPreview` checkbox, stale rate slider range in floating UI).

**Architecture:** Server gains a stateless `GET /engines` endpoint backed by a `KNOWN_ENGINES` constant. The options page replaces its `GET /voices` call with parallel `GET /engines` + `GET /engine` calls and adds engine-change handling. `FloatingUI` gains engine/voice selectors and exposes `onPanelOpen`/`onSwitchEngine`/`onVoiceChange` callbacks; `index.ts` owns all HTTP calls.

**Tech Stack:** Python/Flask (server), TypeScript/browser extension (options + content script), webextension-polyfill.

---

## File Map

| File | Change |
|------|--------|
| `src/server/server.py` | Add `KNOWN_ENGINES`, `GET /engines` route, update `_build_engine` error |
| `src/server/tests/test_server.py` | Tests for `GET /engines` and `KNOWN_ENGINES` error message |
| `src/extension/options/index.html` | Add engine `<select>`, showPreview `<input type="checkbox">` |
| `src/extension/options/main.ts` | Replace `fetchVoices` with `fetchEngineState`/`fetchEngines`; add engine change handler; add showPreview to form |
| `src/extension/content/ui.ts` | Add engine/voice selectors; fix rate slider range + `toFixed`; add `updateSettings()`, `setEngines()`, `setVoices()` methods; add `onPanelOpen`, `onSwitchEngine`, `onVoiceChange` callbacks; guard first-open |
| `src/extension/content/index.ts` | Change `settings` to `let`; wire `onPanelOpen`, `onSwitchEngine`, `onVoiceChange` |

---

### Task 1: Server — `KNOWN_ENGINES` + `GET /engines`

**Files:**
- Modify: `src/server/server.py`
- Test: `src/server/tests/test_server.py`

- [ ] **Step 1: Write three failing tests**

Append to `src/server/tests/test_server.py`:

```python
# --- GET /engines ---

def test_get_engines_returns_list(client):
    response = client.get("/engines")
    assert response.status_code == 200
    assert response.content_type == "application/json"
    data = json.loads(response.data)
    assert data == ["kokoro", "kokoro1"]


def test_get_engines_has_cors_header(client):
    response = client.get("/engines")
    assert "Access-Control-Allow-Origin" in response.headers


def test_build_engine_unknown_name_mentions_known_engines():
    from server import _build_engine, KNOWN_ENGINES
    with pytest.raises(ValueError) as exc_info:
        _build_engine("nonexistent", "cpu")
    for engine in KNOWN_ENGINES:
        assert engine in str(exc_info.value)
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd src/server && uv run pytest tests/test_server.py::test_get_engines_returns_list tests/test_server.py::test_get_engines_has_cors_header tests/test_server.py::test_build_engine_unknown_name_mentions_known_engines -v
```

Expected: 3 × FAILED (ImportError or 404).

- [ ] **Step 3: Implement `KNOWN_ENGINES`, `GET /engines`, and update `_build_engine`**

In `src/server/server.py`:

Add after the imports (after `DEFAULT_VOICE = ...` on line 18):

```python
KNOWN_ENGINES: list[str] = ["kokoro", "kokoro1"]
```

Add a new route inside `create_app`, after the `get_engine` route (after line 75):

```python
    @app.route("/engines", methods=["GET"])
    def get_engines():
        return jsonify(KNOWN_ENGINES)
```

Replace the last line of `_build_engine` (line 106):

```python
    raise ValueError(f"Unknown engine: {name!r}. Available: {', '.join(KNOWN_ENGINES)}")
```

- [ ] **Step 4: Run all server tests**

```bash
cd src/server && uv run pytest tests/test_server.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server/server.py src/server/tests/test_server.py
git commit -m "feat(server): add KNOWN_ENGINES constant and GET /engines endpoint"
```

---

### Task 2: Options Page — Engine Selector, showPreview, and `fetchEngineState`

**Files:**
- Modify: `src/extension/options/index.html`
- Modify: `src/extension/options/main.ts`

- [ ] **Step 1: Add engine selector and showPreview checkbox to HTML**

In `src/extension/options/index.html`, replace the form body (everything between `<form id="form">` and `<button type="submit">`) with:

```html
  <form id="form">
    <label>
      <span>TTS server URL</span>
      <input id="serverUrl" type="url" placeholder="https://localhost:5000" />
    </label>
    <label>
      <span>Engine</span>
      <select id="engine"></select>
    </label>
    <label>
      <span>Voice</span>
      <select id="voiceName"></select>
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
    <label style="flex-direction:row;align-items:center;gap:8px;">
      <input id="showPreview" type="checkbox" style="width:auto" />
      <span style="margin:0">Show preview panel</span>
    </label>
    <button type="submit">Save</button>
    <p id="saved">Settings saved.</p>
    <p id="engineError" style="color:red;font-size:0.85rem;visibility:hidden">Failed to switch engine.</p>
  </form>
```

- [ ] **Step 2: Run typecheck to verify HTML compiles**

```bash
cd /home/amirg/read-out && yarn typecheck
```

Expected: no errors in options files.

- [ ] **Step 3: Rewrite `src/extension/options/main.ts`**

Replace the entire file with:

```typescript
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '~/extension/content/settings'

interface EngineState { engine: string; voices: string[] }

const form = document.getElementById('form') as HTMLFormElement
const serverUrlInput = document.getElementById('serverUrl') as HTMLInputElement
const engineSelect = document.getElementById('engine') as HTMLSelectElement
const voiceSelect = document.getElementById('voiceName') as HTMLSelectElement
const extractorSelect = document.getElementById('extractor') as HTMLSelectElement
const rateInput = document.getElementById('rate') as HTMLInputElement
const rateVal = document.getElementById('rateVal') as HTMLSpanElement
const volumeInput = document.getElementById('volume') as HTMLInputElement
const volumeVal = document.getElementById('volumeVal') as HTMLSpanElement
const showPreviewInput = document.getElementById('showPreview') as HTMLInputElement
const savedMsg = document.getElementById('saved') as HTMLParagraphElement
const engineErrorMsg = document.getElementById('engineError') as HTMLParagraphElement

let prevEngine = ''

async function fetchEngineState(serverUrl: string): Promise<EngineState | null> {
  try {
    const res = await fetch(new URL('/engine', serverUrl).toString())
    if (!res.ok) return null
    return await res.json() as EngineState
  } catch {
    return null
  }
}

async function fetchEngines(serverUrl: string): Promise<string[]> {
  try {
    const res = await fetch(new URL('/engines', serverUrl).toString())
    if (!res.ok) return []
    return await res.json() as string[]
  } catch {
    return []
  }
}

function populateEngines(engines: string[], selected: string): void {
  engineSelect.innerHTML = ''
  if (engines.length === 0) {
    const opt = document.createElement('option')
    opt.value = ''
    opt.textContent = '— unavailable —'
    engineSelect.appendChild(opt)
    engineSelect.disabled = true
    return
  }
  engineSelect.disabled = false
  for (const e of engines) {
    const opt = document.createElement('option')
    opt.value = e
    opt.textContent = e
    opt.selected = e === selected
    engineSelect.appendChild(opt)
  }
  prevEngine = engineSelect.value
}

function populateVoices(voices: string[], selected: string): void {
  voiceSelect.innerHTML = ''
  for (const v of voices) {
    const opt = document.createElement('option')
    opt.value = v
    opt.textContent = v
    opt.selected = v === selected
    voiceSelect.appendChild(opt)
  }
}

async function load(): Promise<void> {
  const s = await getSettings()
  serverUrlInput.value = s.serverUrl
  extractorSelect.value = s.extractor
  rateInput.value = String(s.rate)
  rateVal.textContent = s.rate.toFixed(1)
  volumeInput.value = String(s.volume)
  volumeVal.textContent = String(Math.round(s.volume * 100))
  showPreviewInput.checked = s.showPreview

  const [engines, state] = await Promise.all([
    fetchEngines(s.serverUrl),
    fetchEngineState(s.serverUrl),
  ])
  populateEngines(engines, state?.engine ?? '')
  populateVoices(state?.voices ?? [s.voiceName], s.voiceName)
}

engineSelect.addEventListener('change', async () => {
  const selected = engineSelect.value
  engineErrorMsg.style.visibility = 'hidden'
  try {
    const url = new URL('/engine', serverUrlInput.value)
    url.searchParams.set('name', selected)
    const res = await fetch(url.toString(), { method: 'POST' })
    if (!res.ok) throw new Error()
    const state = await res.json() as EngineState
    const currentVoice = voiceSelect.value
    populateVoices(state.voices, currentVoice)
    if (!state.voices.includes(currentVoice) && state.voices.length > 0) {
      await saveSettings({ voiceName: state.voices[0] })
    }
    prevEngine = selected
  } catch {
    engineSelect.value = prevEngine
    engineErrorMsg.style.visibility = 'visible'
  }
})

serverUrlInput.addEventListener('change', async () => {
  const [engines, state] = await Promise.all([
    fetchEngines(serverUrlInput.value),
    fetchEngineState(serverUrlInput.value),
  ])
  populateEngines(engines, state?.engine ?? '')
  populateVoices(state?.voices ?? [voiceSelect.value], voiceSelect.value)
})

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
    voiceName: voiceSelect.value || DEFAULT_SETTINGS.voiceName,
    extractor: extractorSelect.value as 'readability',
    rate: Number(rateInput.value),
    volume: Number(volumeInput.value),
    showPreview: showPreviewInput.checked,
  })
  savedMsg.style.visibility = 'visible'
  setTimeout(() => { savedMsg.style.visibility = 'hidden' }, 2000)
})

void load()
```

- [ ] **Step 4: Run typecheck**

```bash
cd /home/amirg/read-out && yarn typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/extension/options/index.html src/extension/options/main.ts
git commit -m "feat(options): add engine selector, showPreview checkbox; replace GET /voices with GET /engine"
```

---

### Task 3: FloatingUI — Engine/Voice Selectors, Rate Fix, Callbacks, `updateSettings`

**Files:**
- Modify: `src/extension/content/ui.ts`

- [ ] **Step 1: Add new private fields and public callbacks to the class**

In `src/extension/content/ui.ts`, replace the private fields block (lines 131–148) and the public callbacks block (lines 151–157) with:

```typescript
  private readonly host: HTMLDivElement
  private readonly previewEl: HTMLDivElement
  private readonly btnPlay: HTMLButtonElement
  private readonly btnPause: HTMLButtonElement
  private readonly btnStop: HTMLButtonElement
  private readonly btnForward: HTMLButtonElement
  private readonly btnRewind: HTMLButtonElement
  private readonly settingsPanel: HTMLDivElement
  private readonly inputServerUrl: HTMLInputElement
  private readonly selectEngine: HTMLSelectElement
  private readonly selectVoice: HTMLSelectElement
  private readonly selectExtractor: HTMLSelectElement
  private readonly inputRate: HTMLInputElement
  private readonly inputVolume: HTMLInputElement
  private readonly spanRateVal: HTMLSpanElement
  private readonly spanVolumeVal: HTMLSpanElement

  private sentenceMap = new Map<number, HTMLElement>()
  private activeIndex = -1
  private previewOpen = true
  private settingsOpen = false
  private _panelOpened = false
  private _prevEngine = ''

  onPlay?: () => void
  onPause?: () => void
  onStop?: () => void
  onForward?: () => void
  onRewind?: () => void
  onSeekTo?: (index: number) => void
  onSettingsChange?: (partial: Partial<Settings>) => void
  onPanelOpen?: () => void
  onSwitchEngine?: (name: string, revert: () => void) => void
  onVoiceChange?: (voiceName: string) => void
```

- [ ] **Step 2: Replace the constructor body to add engine/voice selectors and fix rate slider**

Replace the `constructor()` body (lines 159–251) with:

```typescript
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

    // Settings panel (shown on demand)
    this.settingsPanel = document.createElement('div')
    this.settingsPanel.className = 'settings-panel'
    this.settingsPanel.hidden = true

    this.inputServerUrl = document.createElement('input')
    this.inputServerUrl.type = 'url'
    this.inputServerUrl.addEventListener('change', () => {
      this.onSettingsChange?.({ serverUrl: this.inputServerUrl.value })
    })

    this.selectEngine = document.createElement('select')
    this.selectEngine.addEventListener('change', () => {
      const selected = this.selectEngine.value
      const prev = this._prevEngine
      const revert = () => {
        this.selectEngine.value = prev
        this.selectEngine.style.borderColor = '#ff4444'
        setTimeout(() => { this.selectEngine.style.borderColor = '' }, 1500)
      }
      this._prevEngine = selected
      this.onSwitchEngine?.(selected, revert)
    })

    this.selectVoice = document.createElement('select')
    this.selectVoice.addEventListener('change', () => {
      this.onVoiceChange?.(this.selectVoice.value)
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
    this.inputRate.min = '0.5'
    this.inputRate.max = '3'
    this.inputRate.step = '0.1'
    this.spanRateVal = document.createElement('span')
    this.spanRateVal.className = 'range-val'
    this.inputRate.addEventListener('input', () => {
      const val = Number(this.inputRate.value)
      this.spanRateVal.textContent = `${val.toFixed(1)}×`
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
      this.settingLabel('Engine', this.selectEngine),
      this.settingLabel('Voice', this.selectVoice),
      this.settingLabel('Extractor', this.selectExtractor),
      this.rangeRow('Rate', this.inputRate, this.spanRateVal),
      this.rangeRow('Volume', this.inputVolume, this.spanVolumeVal),
    )

    container.append(this.previewEl, bar, this.settingsPanel)
    shadow.append(style, container)
    document.body.appendChild(this.host)

    this.update({ state: 'loading', chunkIndex: 0, totalChunks: 0 })
  }
```

- [ ] **Step 3: Add `updateSettings`, `setEngines`, `setVoices` public methods; update `loadChunks`; fix `toggleSettings`**

Replace the `loadChunks` method (lines 253–283) with:

```typescript
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
        span.textContent = text + ' '
        span.dataset.index = String(index)
        span.addEventListener('click', () => { this.onSeekTo?.(index) })
        paraEl.appendChild(span)
        this.sentenceMap.set(index, span)
      }
      this.previewEl.appendChild(paraEl)
    }

    this.updateSettings(settings)
  }

  updateSettings(settings: Settings): void {
    this.inputServerUrl.value = settings.serverUrl
    this.selectExtractor.value = settings.extractor
    this.inputRate.value = String(settings.rate)
    this.spanRateVal.textContent = `${settings.rate.toFixed(1)}×`
    this.inputVolume.value = String(settings.volume)
    this.spanVolumeVal.textContent = `${Math.round(settings.volume * 100)}%`
    this.previewOpen = settings.showPreview
    this.previewEl.hidden = !this.previewOpen
  }

  setEngines(engines: string[], currentEngine: string): void {
    this.selectEngine.innerHTML = ''
    if (engines.length === 0) {
      const opt = document.createElement('option')
      opt.value = ''
      opt.textContent = '— unavailable —'
      this.selectEngine.appendChild(opt)
      this.selectEngine.disabled = true
      return
    }
    this.selectEngine.disabled = false
    for (const e of engines) {
      const opt = document.createElement('option')
      opt.value = e
      opt.textContent = e
      opt.selected = e === currentEngine
      this.selectEngine.appendChild(opt)
    }
    this._prevEngine = this.selectEngine.value
  }

  setVoices(voices: string[], selectedVoice: string): void {
    this.selectVoice.innerHTML = ''
    for (const v of voices) {
      const opt = document.createElement('option')
      opt.value = v
      opt.textContent = v
      opt.selected = v === selectedVoice
      this.selectVoice.appendChild(opt)
    }
  }
```

Replace the `toggleSettings` method (lines 318–321) with:

```typescript
  private toggleSettings(): void {
    this.settingsOpen = !this.settingsOpen
    this.settingsPanel.hidden = !this.settingsOpen
    if (this.settingsOpen && !this._panelOpened) {
      this._panelOpened = true
      this.onPanelOpen?.()
    }
  }
```

- [ ] **Step 4: Run typecheck**

```bash
cd /home/amirg/read-out && yarn typecheck
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/extension/content/ui.ts
git commit -m "feat(ui): add engine/voice selectors, fix rate slider, add updateSettings/setEngines/setVoices methods and panel-open callbacks"
```

---

### Task 4: Wire Callbacks in `index.ts`

**Files:**
- Modify: `src/extension/content/index.ts`

- [ ] **Step 1: Add fetch helpers and wire callbacks in `start()`**

Replace the entire `src/extension/content/index.ts` with:

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
import type { Settings } from './settings'

type Message = { type: 'play' | 'stop' | 'forward' | 'rewind' | 'play-selection'; text?: string }

interface EngineState { engine: string; voices: string[] }

let player: Player | null = null
let ui: FloatingUI | null = null

async function fetchEngines(serverUrl: string): Promise<string[]> {
  try {
    const res = await fetch(new URL('/engines', serverUrl).toString())
    if (!res.ok) return []
    return await res.json() as string[]
  } catch {
    return []
  }
}

async function fetchEngineState(serverUrl: string): Promise<EngineState | null> {
  try {
    const res = await fetch(new URL('/engine', serverUrl).toString())
    if (!res.ok) return null
    return await res.json() as EngineState
  } catch {
    return null
  }
}

async function start(textOverride?: string): Promise<void> {
  let settings: Settings = await getSettings()

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
    settings = { ...settings, ...partial }
    if (partial.rate !== undefined) player?.updateRate(partial.rate)
    if (partial.volume !== undefined) player?.updateVolume(partial.volume)
  }

  ui.onPanelOpen = async () => {
    const [engines, state] = await Promise.all([
      fetchEngines(settings.serverUrl),
      fetchEngineState(settings.serverUrl),
    ])
    ui?.setEngines(engines, state?.engine ?? '')
    ui?.setVoices(state?.voices ?? [settings.voiceName], settings.voiceName)
  }

  ui.onSwitchEngine = async (name, revert) => {
    try {
      const url = new URL('/engine', settings.serverUrl)
      url.searchParams.set('name', name)
      const res = await fetch(url.toString(), { method: 'POST' })
      if (!res.ok) { revert(); return }
      const state = await res.json() as EngineState
      ui?.setVoices(state.voices, settings.voiceName)
      if (!state.voices.includes(settings.voiceName) && state.voices.length > 0) {
        const firstVoice = state.voices[0]
        await saveSettings({ voiceName: firstVoice })
        settings = { ...settings, voiceName: firstVoice }
        ui?.setVoices(state.voices, firstVoice)
      }
    } catch {
      revert()
    }
  }

  ui.onVoiceChange = async (voiceName) => {
    await saveSettings({ voiceName })
    settings = { ...settings, voiceName }
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
cd /home/amirg/read-out && yarn typecheck
```

Expected: no errors.

- [ ] **Step 3: Run lint**

```bash
cd /home/amirg/read-out && yarn lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/extension/content/index.ts
git commit -m "feat(content): wire onPanelOpen, onSwitchEngine, onVoiceChange callbacks to server endpoints"
```

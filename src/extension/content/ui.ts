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
@keyframes sentence-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
.sentence.loading { animation: sentence-pulse 0.9s ease-in-out infinite; }
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
.btn:not(:disabled):hover { background: rgba(255,255,255,0.12); }
.btn:disabled { opacity: 0.3; cursor: default; }
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
  private readonly selectEngine: HTMLSelectElement
  private readonly selectVoice: HTMLSelectElement
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

    this.selectEngine = document.createElement('select')
    this.selectEngine.addEventListener('change', () => {
      const selected = this.selectEngine.value
      const prev = this._prevEngine
      const revert = () => {
        this.selectEngine.value = prev
        this._prevEngine = prev
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
    this.selectVoice.value = settings.voiceName
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
    if (voices.length === 0) {
      const opt = document.createElement('option')
      opt.value = ''
      opt.textContent = '— no voices —'
      this.selectVoice.appendChild(opt)
      this.selectVoice.disabled = true
      return
    }
    this.selectVoice.disabled = false
    for (const v of voices) {
      const opt = document.createElement('option')
      opt.value = v
      opt.textContent = v
      opt.selected = v === selectedVoice
      this.selectVoice.appendChild(opt)
    }
  }

  update(ps: PlaybackState): void {
    const playing = ps.state === 'playing'
    const loading = ps.state === 'loading'
    // Keep nav buttons visible while loading between sentences (totalChunks > 0 means playback is in progress)
    const showNav = playing || ps.state === 'paused' || (loading && ps.totalChunks > 0)

    this.btnPlay.disabled = playing || loading;
    this.btnPause.disabled = !playing;
    this.btnStop.hidden = ps.state === 'idle' || ps.state === 'stopped'
    this.btnForward.hidden = !showNav
    this.btnRewind.hidden = !showNav

    if (ps.chunkIndex !== this.activeIndex) {
      const prev = this.sentenceMap.get(this.activeIndex)
      prev?.classList.remove('active', 'loading')
      const curr = this.sentenceMap.get(ps.chunkIndex)
      curr?.classList.add('active')
      curr?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      this.activeIndex = ps.chunkIndex
    }

    this.sentenceMap.get(this.activeIndex)?.classList.toggle('loading', loading)
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
    if (this.settingsOpen && !this._panelOpened) {
      this._panelOpened = true
      this.onPanelOpen?.()
    }
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

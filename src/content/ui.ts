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

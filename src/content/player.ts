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

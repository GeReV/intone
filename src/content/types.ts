export type PlaybackState = {
  state: 'idle' | 'loading' | 'playing' | 'paused' | 'stopped' | 'error'
  chunkIndex: number
  totalChunks: number
  error?: string
}

export type PlaybackState = {
  state: "idle" | "loading" | "playing" | "paused" | "stopped" | "error"
  chunkIndex: number
  totalChunks: number
  error?: string
}

export type SentenceChunk = { index: number; text: string }
export type ParagraphGroup = { sentences: SentenceChunk[] }

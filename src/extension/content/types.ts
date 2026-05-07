export type PlaybackState = {
  state: "idle" | "loading" | "playing" | "paused" | "stopped" | "error"
  chunkIndex: number
  totalChunks: number
  autoplayBlocked: boolean
  error: string | undefined
}

export type SentenceChunk = { index: number; text: string }
export type ParagraphGroup = { sentences: SentenceChunk[] }

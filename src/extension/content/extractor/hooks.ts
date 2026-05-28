import type { ExtractorHook } from './types'

// Add site-specific overrides here. First matching hook wins.
export const HOOKS: ExtractorHook[] = [
  {
    // Readability collapses each tweet's text into a single <p> that retains
    // the \n / \n\n characters between the inline <span> sections. Without
    // splitting on those, the chunker batches sentences across logical
    // paragraph breaks inside the tweet.
    matches: (url) => /^https?:\/\/(www\.)?(x\.com|twitter\.com)\//u.test(url),
    transform: (result) => ({
      ...result,
      paragraphs: result.paragraphs.flatMap((p) =>
        p.split(/\n{2,}/u).map((s) => s.trim()).filter(Boolean)
      ),
    }),
  },
]

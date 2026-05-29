import type { ExtractorHook } from './types'

// Add site-specific overrides here. First matching hook wins.
export const HOOKS: ExtractorHook[] = [
  {
    // Readability collapses each tweet's text into a single <p> that retains
    // the \n / \n\n characters between the inline <span> sections. Without
    // splitting on those, the chunker batches sentences across logical
    // paragraph breaks inside the tweet.
    matches: (url) => /^https?:\/\/(www\.)?(x\.com|twitter\.com)\//u.test(url),
    transform: (result) => {
      const UI_HEADINGS = new Set(["Post", "Conversation"]);
      const paragraphs = result.paragraphs
        .filter((p, i) => !(i === 0 && p === result.title))
        .filter((p) => !UI_HEADINGS.has(p))
        .flatMap((p) => p.split(/\n{2,}/u).map((s) => s.trim()).filter(Boolean));
      return { ...result, paragraphs };
    },
  },
]

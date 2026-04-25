import type { ParagraphGroup } from './types'

// Split on whitespace that immediately follows a sentence-ending character.
const SENTENCE_BOUNDARY = /(?<=[.?!])\s+/

export function chunkIntoGroups(paragraphs: string[]): ParagraphGroup[] {
  const groups: ParagraphGroup[] = []
  let flatIndex = 0
  for (const paragraph of paragraphs) {
    const sentences = paragraph
      .split(SENTENCE_BOUNDARY)
      .map(s => s.trim())
      .filter(s => s.length > 0)
    if (sentences.length === 0) continue
    groups.push({
      sentences: sentences.map(text => ({ index: flatIndex++, text })),
    })
  }
  return groups
}

export function chunk(paragraphs: string[]): string[] {
  return chunkIntoGroups(paragraphs).flatMap(g => g.sentences.map(s => s.text))
}

// Split on whitespace that immediately follows a sentence-ending character.
const SENTENCE_BOUNDARY = /(?<=[.?!])\s+/

export function chunk(paragraphs: string[]): string[] {
  const result: string[] = []
  for (const paragraph of paragraphs) {
    const sentences = paragraph
      .split(SENTENCE_BOUNDARY)
      .map(s => s.trim())
      .filter(s => s.length > 0)
    result.push(...sentences)
  }
  return result
}

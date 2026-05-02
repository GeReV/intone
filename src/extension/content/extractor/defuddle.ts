import Defuddle from 'defuddle'
import type { ExtractionResult, Extractor } from './types'

export class DefuddleExtractor implements Extractor {
  extract(document: Document): ExtractionResult {
    const clone = document.cloneNode(true) as Document
    const result = new Defuddle(clone, { url: document.location?.href }).parse()

    if (!result.content) {
      return { title: result.title ?? document.title, paragraphs: [] }
    }

    const parsed = new DOMParser().parseFromString(result.content, 'text/html')
    const paragraphs: string[] = []

    if (result.title) {
      paragraphs.push(result.title)
    }

    parsed.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li:not(:has(> p))').forEach(el => {
      const text = el.textContent?.trim() ?? ''
      if (text) paragraphs.push(text)
    })

    return { title: result.title ?? document.title, paragraphs }
  }
}

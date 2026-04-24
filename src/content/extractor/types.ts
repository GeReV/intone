export type ExtractionResult = {
  title: string
  paragraphs: string[]
}

export interface Extractor {
  // eslint-disable-next-line no-unused-vars
  extract(document: Document): ExtractionResult
}

export interface ExtractorHook {
  // eslint-disable-next-line no-unused-vars
  matches(url: string): boolean
  // eslint-disable-next-line no-unused-vars
  transform(result: ExtractionResult, document: Document): ExtractionResult
}

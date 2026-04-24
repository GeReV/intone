export type ExtractionResult = {
  title: string
  paragraphs: string[]
}

export interface Extractor {
  extract(document: Document): ExtractionResult
}

export interface ExtractorHook {
  matches(url: string): boolean
  transform(result: ExtractionResult, document: Document): ExtractionResult
}

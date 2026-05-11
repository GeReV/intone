// src/extension/content/extractor/defuddle.ts
import type { ExtractionResult, Extractor } from "./types";
import Defuddle from "defuddle";

export class DefuddleExtractor implements Extractor {
  public extract(document: Document): ExtractionResult {
    const clone = document.cloneNode(true) as Document;
    const url = document.location?.href ?? "";
    const result = new Defuddle(clone, { url }).parse();

    // result.content is typed as string but can be empty when Defuddle finds nothing
    if (!result.content) {
      return { title: result.title || document.title, paragraphs: [] };
    }

    const parsed = new DOMParser().parseFromString(result.content, "text/html");
    const paragraphs: string[] = [];

    if (result.title) {
      paragraphs.push(result.title);
    }

    parsed.body.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li:not(:has(> p))").forEach((el) => {
      const text = el.textContent?.trim() ?? "";
      if (text) {
        paragraphs.push(text);
      }
    });

    return { title: result.title || document.title, paragraphs };
  }
}

// src/content/extractor/readability.ts
import type { ExtractionResult, Extractor } from "./types";
import { Readability } from "@mozilla/readability";

export class ReadabilityExtractor implements Extractor {
  public extract(document: Document): ExtractionResult {
    const clone = document.cloneNode(true) as Document;
    const reader = new Readability(clone);
    const article = reader.parse();

    if (!article) {
      return { title: document.title, paragraphs: [] };
    }

    const parsed = new DOMParser().parseFromString(article.content ?? "", "text/html");
    let root: Element | null = parsed.body;

    // unwrap single-child wrappers
    while (root && root.children.length === 1) {
      root = root.firstElementChild;
    }

    if (!root) {
      return { title: article.title ?? document.title, paragraphs: [] };
    }

    const paragraphs: string[] = [];

    if (article.title) {
      paragraphs.push(article.title);
    }

    root.querySelectorAll("p, h1, h2, h3, h4, h5, h6, li:not(:has(> p))").forEach((el) => {
      const text = el.textContent?.trim() ?? "";
      if (text) {
        paragraphs.push(text);
      }
    });

    return { title: article.title ?? document.title, paragraphs };
  }
}

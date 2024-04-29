import { Doc } from "~/contentScripts/types";
import { Readability } from "@mozilla/readability";

export class ReadabilityDoc implements Doc {
  private readability: Readability = new Readability(document.cloneNode(true) as Document);

  private textLines: string[] | null = null;

  getTexts(index: number): Promise<string[] | null> {
    if (!this.textLines) {
      const parsed = this.readability.parse();

      if (parsed) {
        const cleanedDoc = new DOMParser().parseFromString(parsed.content, "text/html");

        // Prepend a newline before paragraphs, so they're never merged with other blocks of text.
        cleanedDoc
          .querySelectorAll("p")
          .forEach(p => {
            p.prepend(cleanedDoc.createTextNode("\n"));
          });

        this.textLines = cleanedDoc.body.textContent?.split("\n").filter(s => s.trim()) ?? [];
      } else {
        this.textLines = [];
      }
    }

    if (index === 0) {
      return Promise.resolve(this.textLines);
    }

    return Promise.resolve(null);
  }
}

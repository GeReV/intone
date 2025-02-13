import { Readability } from "@mozilla/readability";
import { Doc } from "~/contentScripts/types";
import assert from "~/utils/assert";

export class ReadabilityDoc implements Doc {
  private readability: Readability = new Readability(document.cloneNode(true) as Document);

  private textLines: string[] | null = null;

  getTexts(index: number): Promise<string[] | null> {
    if (!this.textLines) {
      const parsed = this.readability.parse();

      if (parsed) {
        const cleanedDoc = new DOMParser().parseFromString(parsed.content, "text/html");

        let content: Element | null = cleanedDoc.body;

        assert(content);

        while (content?.children.length === 1) {
          content = content.firstElementChild;
        }

        if (!content) {
          return Promise.resolve(null);
        }

        const lines: string[] = [
          parsed.title,
        ];

        content.querySelectorAll("p,h1,h2,h3,h4,h5,h6,li:not(:has(> p))").forEach(child => {
          let text = child.textContent?.trim() ?? "";
          if (!text) {
            return;
          }

          if (child.nodeName === "LI") {
            text = text.replace(/(?<![.,:;])$/, ".");
          }

          // TODO: Handle DT/DD?

          lines.push(text);
        });

        this.textLines = lines;
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

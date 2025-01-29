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

        while (content?.childNodes.length === 1) {
          content = content.firstElementChild;
        }

        if (!content) {
          return Promise.resolve(null);
        }

        const lines: string[] = [];

        content.childNodes.forEach(child => {
          const text = child.textContent?.trim() ?? "";
          if (!text) {
            return;
          }

          if (child.nodeName === "OL" || child.nodeName === "UL") {
            let line = "";

            for (const item of Array.from(child.childNodes)) {
              const itemContent = item.textContent?.trim();
              if (!itemContent) {
                continue;
              }

              line += itemContent.replace(/(?<![.,:;])$/, ".") + "\n";
            }

            lines.push(line);
            return;
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

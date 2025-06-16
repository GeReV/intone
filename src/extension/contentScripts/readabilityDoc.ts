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
        const cleanedDoc = new DOMParser().parseFromString(parsed.content ?? "", "text/html");

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
        ].filter(Boolean);

        content.querySelectorAll("p,h1,h2,h3,h4,h5,h6,li:not(:has(> p))").forEach(child => {
          let text = child.textContent?.trim() ?? "";
          if (!text) {
            return;
          }

          if (child.nodeName === "LI") {
            text = this.processNodes(child);
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

  private processNodes(child: Element): string {
    let text = "";

    // NodeList does not currently support an iterator, at least in Typescript.
    // eslint-disable-next-line @typescript-eslint/prefer-for-of
    for (let i = 0; i < child.childNodes.length; i++) {
      const node = child.childNodes[i];

      if (!node) {
        continue;
      }

      if (node.nodeType === Node.TEXT_NODE && node.textContent !== null) {
        // Add a period at the end of an item.
        text += node.textContent.replace(/(?<![.,:;])$/, ".");
        text += "\n";
      }

      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element;
        let content = "";

        // If this element has any nested lists, continue building it node-by-node,
        // otherwise just add its text contents.
        if (el.querySelector("li")) {
          content = this.processNodes(el);
        } else {
          content = el.textContent ?? "";
        }

        // Add a period at the end of an item.
        text += content.replace(/(?<![.,:;])$/, ".");
        text += "\n";
      }
    }

    return text;
  }
}

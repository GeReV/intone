import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { DefuddleExtractor } from "../../../src/extension/content/extractor/defuddle";

function makeDoc(html: string): Document {
  return new JSDOM(html, { url: "https://example.com/" }).window.document;
}

describe("DefuddleExtractor", () => {
  it("extracts paragraphs from article content", () => {
    const doc = makeDoc(`
      <html>
        <head><title>My Article</title></head>
        <body>
          <article>
            <h1>My Article</h1>
            <p>First paragraph of content.</p>
            <p>Second paragraph of content.</p>
          </article>
        </body>
      </html>
    `);

    const extractor = new DefuddleExtractor();
    const result = extractor.extract(doc);

    expect(result.paragraphs).toContain("First paragraph of content.");
    expect(result.paragraphs).toContain("Second paragraph of content.");
  });

  it("handles minimal pages gracefully", () => {
    // Defuddle is more aggressive than Readability and extracts content even
    // from nav-only pages, so we only assert structural shape here.
    const doc = makeDoc(`
      <html>
        <head><title>Empty</title></head>
        <body><div>Navigation only</div></body>
      </html>
    `);

    const extractor = new DefuddleExtractor();
    const result = extractor.extract(doc);

    expect(typeof result.title).toBe("string");
    expect(Array.isArray(result.paragraphs)).toBe(true);
  });

  it("does not mutate the original document", () => {
    const doc = makeDoc(`
      <html>
        <head><title>Test</title></head>
        <body><article><p>Content here.</p></article></body>
      </html>
    `);

    const originalHTML = doc.documentElement.outerHTML;
    const extractor = new DefuddleExtractor();
    extractor.extract(doc);

    expect(doc.documentElement.outerHTML).toBe(originalHTML);
  });
});

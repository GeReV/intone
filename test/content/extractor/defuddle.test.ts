import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { DefuddleExtractor } from "../../src/extension/content/extractor/defuddle";

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

    expect(result.paragraphs.length).toBeGreaterThan(0);
    expect(result.paragraphs).toContain("First paragraph of content.");
    expect(result.paragraphs).toContain("Second paragraph of content.");
  });

  it("returns empty paragraphs when page has no article content", () => {
    const doc = makeDoc(`
      <html>
        <head><title>Empty</title></head>
        <body><div>Navigation only</div></body>
      </html>
    `);

    const extractor = new DefuddleExtractor();
    const result = extractor.extract(doc);

    expect(result.title).toBeDefined();
    expect(result.paragraphs).toHaveLength(0);
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

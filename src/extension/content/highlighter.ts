const HIGHLIGHT_NAME = "readout-active";
const STYLE_EL_ID = "__readout_hl_style";

// Uses the CSS Custom Highlight API so we can mark text without touching the DOM.
const CSS_TEXT = `
::highlight(${HIGHLIGHT_NAME}) {
  background-color: rgba(255, 220, 0, 0.35);
}
@media (prefers-color-scheme: dark) {
  ::highlight(${HIGHLIGHT_NAME}) {
    background-color: rgba(255, 220, 0, 0.2);
  }
}
`.trim();

/**
 * A single DOM text node paired with its normalized form and its offset within the
 * concatenated haystack. Keeping both `raw` and `norm` lets us locate text in the
 * normalized space and then map back to the exact character position in the real DOM.
 */
interface Segment {
  node: Text;
  raw: string;
  // Whitespace collapsed to single spaces, to match how Readability emits text.
  norm: string;
  // Start position of this segment's norm string within the concatenated haystack.
  normOffset: number;
}

/**
 * Walks every visible text node in the page and builds two parallel structures:
 * - `segments`: one entry per text node, carrying the node itself, its raw text, and a
 *   whitespace-normalized copy aligned to how Readability emits paragraph text.
 * - `haystack`: all normalized texts joined into one string, used for substring search.
 *
 * Joining into a single string is what makes it possible to locate a phrase that straddles
 * a tag boundary (e.g. a sentence split across two `<span>` elements).
 */
function buildSegments(): { segments: Segment[]; haystack: string } {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const el = node.parentElement;
      if (!el) {
        return NodeFilter.FILTER_REJECT;
      }

      const tag = el.tagName.toLowerCase();

      // Invisible elements have text content that would corrupt the haystack.
      if (tag === "script" || tag === "style" || tag === "noscript") {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const segments: Segment[] = [];
  let haystack = "";
  let t: Node | null = null;

  while ((t = walker.nextNode())) {
    const node = t as Text;
    const raw = node.data;
    // Collapse whitespace runs so the haystack matches the Readability output.
    const norm = raw.replace(/\s+/gu, " ");

    segments.push({
      node,
      raw,
      norm,
      normOffset: haystack.length,
    });

    // Concatenate into one string so we can find text that spans multiple text nodes.
    haystack += norm;
  }

  return { segments, haystack };
}

/**
 * Locates `searchText` in the pre-built haystack and returns a DOM `Range` spanning
 * exactly those characters in the live document, or `null` if not found.
 *
 * The search is done in normalized space (whitespace collapsed) so it tolerates
 * differences between how the DOM stores whitespace and how Readability emits text.
 * After the match is found, `resolve()` maps each endpoint back to a raw text-node
 * offset by replaying the whitespace-collapsing walk in reverse.
 */
function findRange(searchText: string, segments: Segment[], haystack: string): Range | null {
  const needle = searchText.trim().replace(/\s+/gu, " ");
  if (!needle) {
    return null;
  }

  const start = haystack.indexOf(needle);

  if (start === -1) {
    return null;
  }

  const end = start + needle.length;

  // Maps a position in the normalized haystack back to its raw DOM text node offset.
  // The tricky part: a whitespace run in raw (e.g. "\n  ") counts as one character in norm,
  // so we walk raw chars tracking whether we're inside a run to count norm chars correctly.
  function resolve(normPos: number): { node: Text; offset: number } | null {
    for (const seg of segments) {
      const segEnd = seg.normOffset + seg.norm.length;

      if (normPos < seg.normOffset || normPos > segEnd) {
        continue;
      }

      const normOffsetInSeg = normPos - seg.normOffset;

      let rawPos = 0;
      let normCount = 0;
      let inWs = false;

      for (let j = 0; j < seg.raw.length && normCount < normOffsetInSeg; j++) {
        const isWs = /\s/u.test(seg.raw[j] ?? "");
        if (isWs) {
          if (!inWs) {
            normCount++;
            inWs = true;
          }
        } else {
          normCount++;
          inWs = false;
        }
        rawPos = j + 1;
      }

      return {
        node: seg.node,
        offset: rawPos,
      };
    }
    return null;
  }

  const startPos = resolve(start);
  const endPos = resolve(end);
  if (!startPos || !endPos) {
    return null;
  }

  try {
    const range = document.createRange();

    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset);

    return range;
  } catch {
    // setStart/setEnd throws if a node was removed from the DOM after indexing.
    return null;
  }
}

/**
 * Manages sentence-level highlighting for a single page using the CSS Custom Highlight API.
 *
 * On construction, it registers a named `Highlight` object and injects the matching
 * `::highlight()` style rule. Callers then call `buildIndex()` once to pre-compute a
 * `Range` for every TTS chunk, and `setActive()` on each chunk change to swap the
 * visible highlight with zero DOM mutations.
 *
 * Falls back gracefully when the API is unavailable (`isSupported()` returns false);
 * callers are expected to skip construction in that case.
 */
export class PageHighlighter {
  private readonly hl: Highlight;
  // Pre-computed Range per chunk index; avoids re-walking the DOM on every setActive call.
  private readonly chunkRanges = new Map<number, Range>();
  private enabled: boolean;
  private activeIndex = -1;

  public constructor(enabled: boolean) {
    this.enabled = enabled;
    this.hl = new Highlight();
    CSS.highlights.set(HIGHLIGHT_NAME, this.hl);

    const style = document.createElement("style");
    style.id = STYLE_EL_ID;
    style.textContent = CSS_TEXT;
    document.head.appendChild(style);
  }

  public static isSupported(): boolean {
    return "highlights" in CSS;
  }

  // Called once per session, before playback begins, to map every chunk to a DOM range.
  public buildIndex(chunks: string[]): void {
    const { segments, haystack } = buildSegments();

    for (let i = 0; i < chunks.length; i++) {
      const range = findRange(chunks[i] ?? "", segments, haystack);

      if (range) {
        this.chunkRanges.set(i, range);
      }
    }
  }

  public setActive(index: number): void {
    if (index === this.activeIndex) {
      return;
    }

    this.activeIndex = index;
    // Always clear first: the Highlight object is a Set and we only ever want one range lit.
    this.hl.clear();

    if (!this.enabled) {
      return;
    }

    const range = this.chunkRanges.get(index);

    if (range) {
      this.hl.add(range);
    }
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;

    if (!enabled) {
      this.hl.clear();
    } else {
      const range = this.chunkRanges.get(this.activeIndex);

      if (range) {
        this.hl.add(range);
      }
    }
  }

  // Removes the highlight and the injected style so nothing lingers after the player closes.
  public destroy(): void {
    this.hl.clear();

    CSS.highlights.delete(HIGHLIGHT_NAME);

    document.getElementById(STYLE_EL_ID)?.remove();
  }
}

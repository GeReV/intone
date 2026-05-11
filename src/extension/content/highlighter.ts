const HIGHLIGHT_NAME = "readout-active";
const STYLE_EL_ID = "__readout_hl_style";

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

interface Segment {
  node: Text;
  raw: string;
  norm: string;
  normOffset: number;
}

function buildSegments(): { segments: Segment[]; haystack: string } {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const el = node.parentElement;
      if (!el) {
        return NodeFilter.FILTER_REJECT;
      }

      const tag = el.tagName.toLowerCase();

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
    const norm = raw.replace(/\s+/gu, " ");

    segments.push({
      node,
      raw,
      norm,
      normOffset: haystack.length,
    });

    haystack += norm;
  }

  return { segments, haystack };
}

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
    return null;
  }
}

export class PageHighlighter {
  private readonly hl: Highlight;
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

  public destroy(): void {
    this.hl.clear();

    CSS.highlights.delete(HIGHLIGHT_NAME);

    document.getElementById(STYLE_EL_ID)?.remove();
  }
}

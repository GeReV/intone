import { getMath } from "~/contentScripts/math";

const IGNORE_TAGS = "select, textarea, button, label, audio, video, dialog, embed, menu, nav, noframes, noscript, object, script, style, svg, aside, footer, #footer, .no-read-aloud";

const PARAGRAPH_SPLITTER = /(?:\s*\r?\n\s*){2,}/;

const getInnerText = (node: Element | undefined) => (node?.textContent ?? "").trim();

const addMissingPunctuation = (text: string) => text.replace(/(\w)(\s*?\r?\n)/g, "$1.$2");

const getText = (elem: Element) => addMissingPunctuation(elem.textContent ?? "").trim();

function someChildNodes(node: ParentNode, test: (child: ChildNode) => boolean) {
  let child = node.firstChild;

  while (child) {
    if (test(child)) {
      return true;
    }
    child = child.nextSibling;
  }

  return false;
}

function previousNode(node: Node, skipChildren: boolean) {
  if (node.nodeName === "BODY") {
    return null;
  }
  if (node.nodeType === 1 && !skipChildren && node.lastChild) {
    return node.lastChild;
  }
  if (node.previousSibling) {
    return node.previousSibling;
  }
  if (node.parentNode) {
    return previousNode(node.parentNode, true);
  }

  return null;
}

function getHeadingLevel(elem: Element | undefined): number {
  const matches = elem && /^H(\d)$/i.exec(elem.tagName);

  return matches ? Number(matches[1]) : 100;
}

function findHeadingsFor(block: Element, prevBlock: Element | undefined): Element[] {
  const result = [];
  const firstInnerElem = Array.from(block.querySelectorAll("h1, h2, h3, h4, h5, h6, p")).find(el => el.checkVisibility());
  let currentLevel = getHeadingLevel(firstInnerElem);
  let node = previousNode(block, true);

  while (node && node !== prevBlock) {
    const ignore = node instanceof Element && node.matches(IGNORE_TAGS);
    if (!ignore && node instanceof Element && node.checkVisibility()) {
      const level = getHeadingLevel(node);

      if (level < currentLevel) {
        result.push(node);
        currentLevel = level;
      }
    }

    node = previousNode(node, ignore);
  }

  return result.reverse();
}

function dontRead(el: Element) {
  return el.matches(IGNORE_TAGS) || el.matches("sup") || (el instanceof HTMLElement && (el.style.float === "right" || el.style.position === "fixed"));
}

function addNumbering(el: Element) {
  const children = el.children;
  const text = children.length ? getInnerText(children[0]) : null;

  if (text && !text.match(/^[(]?(\d|[a-zA-Z][).])/))
    for (let i = 0; i < children.length; i++) {
      const span = document.createElement("span");
      span.classList.add("read-aloud-numbering");
      span.textContent = `${i + 1}. `;

      children[i]?.prepend(span);
    }
}

function getGaussian(texts: string[], start = 0, end: number = texts.length) {
  let i;
  let sum = 0;

  for (i = start; i < end; i++) {
    sum += texts[i]?.length ?? 0;
  }

  const mean = sum / (end - start);
  let variance = 0;

  for (i = start; i < end; i++) {
    const len = texts[i]?.length ?? 0;

    variance += (len - mean) * (len - mean);
  }

  return { mean: mean, stdev: Math.sqrt(variance) };
}

export class HtmlDoc {
  getCurrentIndex() {
    return 0;
  }

  async getTexts(index: number, _quietly: boolean) {
    if (index === 0) {
      const math = await getMath();
      try {
        if (math) {
          math.show();
        }
        return this.parse();
      } finally {
        if (math) {
          math.hide();
        }
      }
    }

    return null;
  }

  async getSelectedText() {
    const math = await getMath();
    try {
      if (math) {
        math.show();
      }
      return (window.getSelection()?.toString() ?? "").trim();
    } finally {
      if (math) {
        math.hide();
      }
    }
  }


  private parse() {
    let i;
    let dist;
    //find blocks containing text
    const start = Date.now();

    let textBlocks = this.findTextBlocks(50);

    const countChars = textBlocks.reduce((sum, elem) => sum + getInnerText(elem).length, 0);

    console.log("Found", textBlocks.length, "blocks", countChars, "chars in", Date.now() - start, "ms");

    if (countChars < 1000) {
      textBlocks = this.findTextBlocks(3);
      const texts = textBlocks.map(getInnerText);

      console.log("Using lower threshold, found", textBlocks.length, "blocks", texts.join("").length, "chars");

      //trim the head and the tail
      let head, tail;

      for (i = 3; i < texts.length && !head; i++) {
        dist = getGaussian(texts, 0, i);
        if ((texts[i]?.length ?? 0) > dist.mean + 2 * dist.stdev) {
          head = i;
        }
      }

      for (i = texts.length - 4; i >= 0 && !tail; i--) {
        dist = getGaussian(texts, i + 1, texts.length);
        if ((texts[i]?.length ?? 0) > dist.mean + 2 * dist.stdev) {
          tail = i + 1;
        }
      }

      if (head ?? tail) {
        textBlocks = textBlocks.slice(head ?? 0, tail);
        console.log("Trimmed", head, tail);
      }
    }

    //mark the elements to be read
    const toRead: Element[] = [];
    for (i = 0; i < textBlocks.length; i++) {
      const block = textBlocks[i];
      if (block) {
        toRead.push(...findHeadingsFor(block, textBlocks[i - 1]));
        toRead.push(block);
      }
    }

    //for debugging only
    for (const el of toRead) {
      el.classList.add("read-aloud");
    }

    function getTexts(elem: Element) {
      const toHide = Array.from(elem.children).filter(el => el.checkVisibility() && dontRead(el));

      for (const hide of toHide) {
        hide.toggleAttribute("hidden", true);
      }

      elem.querySelectorAll("ol, ul").forEach(addNumbering);

      const texts = elem.hasAttribute("data-read-aloud-multi-block")
        ? Array.from(elem.children).filter(el => el.checkVisibility()).map(getText)
        : getText(elem).split(PARAGRAPH_SPLITTER);

      elem.querySelectorAll(".read-aloud-numbering").forEach(el => {
        el.remove();
      });

      for (const hide of toHide) {
        hide.toggleAttribute("hidden", false);
      }

      return texts;
    }

    //extract texts
    return toRead.flatMap(getTexts).filter(Boolean);
  }

  private findTextBlocks(threshold: number) {
    const skipTags = "h1, h2, h3, h4, h5, h6, p, a[href], " + IGNORE_TAGS;
    const textBlocks: Element[] = [];

    const isTextNode = (node: Node) => node.nodeType === 3 && (node.nodeValue ?? "").trim().length >= 3;

    const isParagraph = (node: Node) => node instanceof Element && node.matches("p") && node.checkVisibility() && getInnerText(node).length >= threshold;

    const hasTextNodes = (elem: Element) => someChildNodes(elem, isTextNode) && getInnerText(elem).length >= threshold;

    const hasParagraphs = (elem: Element) => someChildNodes(elem, isParagraph);

    const containsTextBlocks = (elem: Element) => {
      const childElems = Array.from(elem.querySelectorAll(`:scope > :not(${skipTags})`));

      return childElems.some(hasTextNodes) || childElems.some(hasParagraphs) || childElems.some(containsTextBlocks);
    };

    const addBlock = function (elem: Element, multi = false) {
      if (multi) {
        elem.setAttribute("data-read-aloud-multi-block", "true");
      }
      textBlocks.push(elem);
    };

    const walk = function (el: Element) {
      // noinspection JSDeprecatedSymbols
      if (el instanceof HTMLFrameElement || el instanceof HTMLIFrameElement) {
        try {
          if (el.contentDocument) {
            walk(el.contentDocument.body);
          }
        } catch (err) {
          /* empty */
        }
      } else if (el.matches("dl")) {
        addBlock(el);
      } else if (el.matches("ol, ul")) {
        const items = Array.from(el.children);

        if (items.some(hasTextNodes)) {
          addBlock(el);
        } else if (items.some(hasParagraphs)) {
          addBlock(el, true);
        } else if (items.some(containsTextBlocks)) {
          addBlock(el, true);
        }
      } else if (el.matches("tbody")) {
        const rows = Array.from(el.children);

        if (rows.length > 3 || (rows[0]?.children.length ?? 0) > 3) {
          if (rows.some(containsTextBlocks)) {
            addBlock(el, true);
          }
        } else {
          rows.forEach(walk);
        }
      } else {
        if (hasTextNodes(el)) {
          addBlock(el);
        } else if (hasParagraphs(el)) {
          addBlock(el, true);
        } else {
          [el, el.shadowRoot].forEach(e => {
            e?.querySelectorAll(`:scope > :not(${skipTags})`)
              .forEach(walk);
          });
        }
      }
    };

    walk(document.body);

    return textBlocks.filter(elem => elem.checkVisibility() && elem.getBoundingClientRect().left >= 0);
  }
}
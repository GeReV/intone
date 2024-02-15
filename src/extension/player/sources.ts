import browser from "webextension-polyfill";
import { HtmlDoc } from "~/contentScripts/htmlDoc";

export type DocumentInfo = {
  url: string,
  title: string,
  lang: string | undefined,
  detectedLang?: string
};

export interface Source {
  ready: Promise<DocumentInfo>;

  getTexts(index: number, quietly?: boolean): Promise<string[] | null>;

  isWaiting(): boolean;

  getCurrentIndex(): Promise<number>;

  getUri(): string | Promise<string>;

  close(): Promise<void>;
}

export class SimpleSource implements Source {
  readonly ready: Promise<DocumentInfo>;

  constructor(private readonly texts: string[], opts: { lang: string | undefined }) {
    this.ready = Promise.resolve<DocumentInfo>({
      url: "",
      title: "",
      lang: opts.lang,
    });
  }

  isWaiting() {
    return false;
  }

  getCurrentIndex() {
    return Promise.resolve(0);
  }

  getTexts(index: number): Promise<string[] | null> {
    if (index === 0) {
      return Promise.resolve(this.texts);
    }

    return Promise.resolve(null);
  }

  async close() {
    /* empty */
  }

  getUri() {
    const textLen = this.texts.reduce((sum, text) => sum + text.length, 0);

    return `text-selection:(${textLen})${encodeURIComponent((this.texts[0] ?? "").slice(0, 100))}`;
  }
}

const PARAGRAPH_SPLITTER = /(?:\s*\r?\n\s*){2,}/;

function getLang() {
  let lang = document.documentElement.lang || document.documentElement.getAttribute("xml:lang");
  if (lang) {
    const [l,] = lang.split(",", 1);
    lang = (l ?? lang).replace(/_/g, "-");
  }
  return lang ?? undefined;
}

function getDocumentInfo() {
  return {
    url: location.href,
    title: document.title,
    lang: getLang(),
  };
}


export class TabSource implements Source {

  private waiting = true;
  // private currentPage = 0;

  ready: Promise<DocumentInfo>;

  private htmlDoc: HtmlDoc;

  constructor() {
    this.ready = Promise.resolve(getDocumentInfo());

    this.htmlDoc = new HtmlDoc();

    void this.initialize();
  }

  private async initialize(): Promise<void> {
    try {
      const obj = await browser.storage.local.get("sourceUri");
      const uri = String(obj.sourceUri);

      if (uri.startsWith("contentscript:")) {
        // const tabId = Number(uri.substring(14));


      } else if (uri.startsWith("epubreader:")) {
        // const extensionId = uri.substring(11);
        //
        // this.sendToSource = (messageId, data) => this.sendToEpubReader(messageId, data, extensionId);
        //
        // const res = await this.sendToSource("get-document-info", null);
        //
        // if (!res.success) {
        //   throw new Error("Failed to get EPUB document info");
        // }
        // if (res.lang && !/^[a-z][a-z](-[A-Z][A-Z])?$/.test(res.lang)) {
        //   res.lang = null;
        // }
        // if (res.lang) {
        //   res.detectedLang = res.lang;
        // }   //prevent lang detection
        //
        // this.ready = Promise.resolve(res);

        throw new Error("Unsupported source: epubreader");
      } else if (uri.startsWith("pdfviewer:")) {
        // this.sendToSource = (messageId, data) => this.sendToPdfViewer(message);
        //
        // this.ready = this.sendToSource({ method: "get-document-info" });
        throw new Error("Unsupported source: pdfviewer");
      } else {
        throw new Error("Invalid source");
      }
    } finally {
      this.waiting = false;
    }
  }

  isWaiting() {
    return this.waiting;
  }

  private getSelectedText() {
    return this.htmlDoc.getSelectedText();
  }

  async getCurrentIndex(): Promise<number> {
    this.waiting = true;

    try {
      if (await this.getSelectedText()) {
        return -100;
      }

      return this.htmlDoc.getCurrentIndex();
    } finally {
      this.waiting = false;
    }
  }

  async getTexts(index: number, quietly = true): Promise<string[] | null> {
    this.waiting = true;

    try {
      if (index < 0) {
        if (index === -100) {
          return (await this.getSelectedText()).split(PARAGRAPH_SPLITTER);
        }

        return null;
      } else {
        const texts = await this.htmlDoc.getTexts(index);

        if (Array.isArray(texts)) {
          if (!quietly) {
            console.log(texts.join("\n\n"));
          }
        }

        return texts;
      }
    } finally {
      this.waiting = false;
    }
  }


  async close() {
    /* empty */
  }

  async getUri() {
    const info = await this.ready;

    return info.url;
  }

  // async sendToEpubReader<K extends DataTypeKey>(extId: string, messageId: K, data: GetDataType<K, JsonValue>): Promise<GetReturnType<K, JsonValue>> {
  //   const getTexts = async (index: number) => {
  //     let res: { success: boolean, paged: boolean, text?: string } = { success: true, paged: true };
  //
  //     for (; this.currentPage < index; this.currentPage++) {
  //       res = await browser.runtime.sendMessage(extId, { name: "pageForward" });
  //     }
  //
  //     for (; this.currentPage > index; this.currentPage--) {
  //       res = await browser.runtime.sendMessage(extId, { name: "pageBackward" });
  //     }
  //
  //     if (!res.success) {
  //       throw new Error("Failed to flip EPUB page");
  //     }
  //
  //     res = res.paged ?
  //       await browser.runtime.sendMessage(extId, { name: "getPageText" }) :
  //       {
  //         success: true,
  //         text: null
  //       };
  //
  //     if (!res.success) {
  //       throw new Error("Failed to get EPUB text");
  //     }
  //
  //     return res.text && parseXhtml(res.text);
  //   };
  //
  //   switch (messageId) {
  //     case "get-document-info":
  //       return browser.runtime.sendMessage(extId, { name: messageId });
  //     case "get-current-index":
  //       return { index: this.currentPage };
  //     case "get-texts":
  //       return getTexts(data.index);
  //     default:
  //       throw new Error("Bad method");
  //   }
  //
  //   function parseXhtml(xml: string) {
  //     const dom = new DOMParser().parseFromString(xml, "text/xml");
  //     const nodes = dom.body.querySelectorAll("h1, h2, h3, h4, h5, h6, p");
  //
  //     return Array.from(nodes)
  //       .map(node => (node.textContent ?? "").trim().replace(/\r?\n/g, " "))
  //       .filter(Boolean);
  //   }
  // }

  // async sendToPdfViewer(message: SourceMessage) {
  //   // TODO
  //   // message.dest = "pdfViewer";
  //
  //   const result = await browser.runtime.sendMessage(message)
  //     .catch(err => {
  //       if (/^(A listener indicated|Could not establish)/.test(err.message)) throw new Error(err.message + " " + message.method);
  //       throw err;
  //     });
  //
  //   if (result && result.error) {
  //     throw result.error;
  //   }
  //
  //   return result;
  // }
}



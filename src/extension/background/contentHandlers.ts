import browser from "webextension-polyfill";
import { UNSUPPORTED_SITES } from "~/utils";

interface ContentHandler {
  match: (url: string, title?: string) => boolean;
  validate?: (tab: browser.Tabs.Tab) => Promise<void>;
  getFrameId?: (frames: browser.WebNavigation.GetAllFramesCallbackDetailsItemType[] | null) => number | undefined;
  getSourceUri?: (tab: browser.Tabs.Tab) => string;
  extraScripts?: string[];
}

const ONEDRIVE_TARGET_ORIGINS = [
  "https://word-edit.officeapps.live.com/",
  "https://usc-word-edit.officeapps.live.com/",
];

export const CONTENT_HANDLERS: ContentHandler[] = [
  // Unsupported Sites --------------------------------------------------------
  {
    match: (url: string) => UNSUPPORTED_SITES.some(site => (typeof site == "string" && url.startsWith(site)) || (site instanceof RegExp && site.test(url))),
    validate() {
      throw new Error(JSON.stringify({ code: "error_page_unreadable" }));
    }
  },

  // PDF file:// --------------------------------------------------------------
  // {
  //   match: (url: string) => /^file:.*\.pdf$/i.test(url.split("?")[0]),
  //   async validate(tab) {
  //     await browser.tabs.update(tab.id, { url: config.pdfViewerUrl });
  //     throw new Error(JSON.stringify({ code: "error_upload_pdf" }));
  //   }
  // },

  // file:// ------------------------------------------------------------------
  {
    match: (url: string) => url.startsWith("file:"),
    async validate() {
      const allowed = await browser.extension.isAllowedFileSchemeAccess();

      if (!allowed) {
        throw new Error(JSON.stringify({ code: "error_file_access" }));
      }
    }
  },

  // Google Docs ---------------------------------------------------------------
  {
    match: url => url.startsWith("https://docs.google.com/document/d/"),
    validate: (() => {
      let alreadyAsked = false;

      return async () => {
        if (alreadyAsked) {
          return;
        } else {
          alreadyAsked = true;
        }

        const perms = {
          origins: ["https://docs.google.com/document/d/"]
        };

        const has = await browser.permissions.contains(perms);
        if (!has) {
          throw new Error(JSON.stringify({ code: "error_add_permissions", perms: perms, reload: true }));
        }
      };
    })(),
  },

  // Google Play Books ---------------------------------------------------------
  {
    match: url => /^https:\/\/play.google.com\/books\/reader/.test(url) || /^https:\/\/books.google.com\/ebooks\/app#reader/.test(url),
    async validate() {
      const perms = {
        permissions: ["webNavigation"],
        origins: ["https://books.googleusercontent.com/"]
      };

      const has = await browser.permissions.contains(perms);

      if (!has) {
        throw new Error(JSON.stringify({ code: "error_add_permissions", perms: perms }));
      }
    },
    getFrameId(frames) {
      const frame = frames?.find((frame) => frame.url.startsWith("https://books.googleusercontent.com/"));

      return frame?.frameId;
    },
    extraScripts: ["js/content/google-play-book.js"]
  },

  // OneDrive Doc -----------------------------------------------------------
  {
    match: (url, title) => url.startsWith("https://onedrive.live.com/edit.aspx") && (title ?? "").includes(".docx")
      || /^https:\/\/[^/]+\.sharepoint\.com\//.test(url)
      || url.startsWith("https://www.dropbox.com/") && (url.split("?")[0]?.endsWith(".docx") ?? false),
    async validate() {
      const perms = {
        permissions: ["webNavigation"],
        origins: ONEDRIVE_TARGET_ORIGINS
      };

      const has = await browser.permissions.contains(perms);
      if (!has) {
        throw new Error(JSON.stringify({ code: "error_add_permissions", perms: perms }));
      }
    },
    getFrameId(frames) {
      const frame = frames?.find(frame => ONEDRIVE_TARGET_ORIGINS.some(origin => frame.url.startsWith(origin)));
      return frame?.frameId;
    },
    extraScripts: ["js/content/onedrive-doc.js"]
  },

  // Chegg NEW --------------------------------------------------------------
  {
    match: url => url.startsWith("https://www.chegg.com/reader/"),
    async validate() {
      const perms = {
        permissions: ["webNavigation"],
        origins: ["https://ereader-web-viewer.chegg.com/"]
      };

      const has = await browser.permissions.contains(perms);
      if (!has) {
        throw new Error(JSON.stringify({ code: "error_add_permissions", perms: perms }));
      }
    },
    getFrameId(frames) {
      const frame = frames?.find((frame) => frame.url.startsWith("https://ereader-web-viewer.chegg.com/"));

      return frame?.frameId;
    },
    extraScripts: ["js/content/chegg-book.js"]
  },

  // VitalSource/Chegg ---------------------------------------------------------
  {
    match(url) {
      return /^https:\/\/\w+\.vitalsource\.com\/(#|reader)\/books\//.test(url) ||
        /^https:\/\/\w+\.chegg\.com\/(#|reader)\/books\//.test(url);
    },
    async validate() {
      const perms = {
        permissions: ["webNavigation"],
        origins: ["https://jigsaw.vitalsource.com/", "https://jigsaw.chegg.com/"]
      };

      const has = await browser.permissions.contains(perms);
      if (!has) {
        throw new Error(JSON.stringify({ code: "error_add_permissions", perms: perms }));
      }
    },
    getFrameId(frames) {
      const frame = frames?.find(frame => {
        const url = new URL(frame.url);
        return url.hostname.startsWith("jigsaw.") && url.pathname.startsWith("/books/");
      });

      return frame?.frameId;
    },
    extraScripts: ["js/content/vitalsource-book.js"]
  },

  // Liberty University ---------------------------------------------------------
  {
    match: url => url.startsWith("https://luoa.instructure.com/courses/"),
    async validate() {
      const perms = {
        permissions: ["webNavigation"],
        origins: ["https://luoa-content.s3.amazonaws.com/"]
      };
      const has = await browser.permissions.contains(perms);

      if (!has) {
        throw new Error(JSON.stringify({ code: "error_add_permissions", perms: perms }));
      }
    },
    getFrameId(frames) {
      const frame = frames?.find(function (frame) {
        return frame.url && frame.url.startsWith("https://luoa-content.s3.amazonaws.com/");
      });

      return frame?.frameId;
    }
  },

  // EPUBReader ---------------------------------------------------------------
  {
    match: url => /^chrome-extension:\/\/jhhclmfgfllimlhabjkgkeebkbiadflb\/reader.html/.test(url),
    getSourceUri: () => "epubreader:jhhclmfgfllimlhabjkgkeebkbiadflb"
  },

  // Read Aloud PDF viewer ---------------------------------------------------
  {
    match: url => url.startsWith(browser.runtime.getURL("pdf-viewer.html")),
    getSourceUri: () => "pdfviewer:",
  },

  // Adobe Acrobat extension -------------------------------------------------
  // {
  //   match: url => url.startsWith("chrome-extension://efaidnbmnnnibpcajpcglclefindmkaj/"),
  //   async validate(tab) {
  //     const pdfUrl = tab.url?.slice(52) ?? "";
  //     if (pdfUrl.startsWith("file://")) {
  //       await browser.tabs.update(tab.id, { url: config.pdfViewerUrl });
  //
  //       throw new Error(JSON.stringify({ code: "error_upload_pdf" }));
  //     } else {
  //       await openPdfViewer(tab.id, pdfUrl);
  //     }
  //   },
  //   getSourceUri: () => "pdfviewer:",
  // },

  // Kami extension -----------------------------------------------------------
  // {
  //   match: url => url.startsWith("https://web.kamihq.com/web/viewer.html?source=extension_pdfhandler&"),
  //   validate: tab => openPdfViewer(tab.id, new URL(tab.url ?? "").searchParams.get("file")),
  //   getSourceUri: () => "pdfviewer:",
  // },

  // LibbyApp ---------------------------------------------------------------
  {
    match: url => url.startsWith("https://libbyapp.com/open/"),
    async validate() {
      const perms = {
        permissions: ["webNavigation"],
        origins: ["https://*.read.libbyapp.com/"]
      };

      const has = await browser.permissions.contains(perms);

      if (!has) {
        throw new Error(JSON.stringify({ code: "error_add_permissions", perms: perms }));
      }
    },
    getFrameId(frames) {
      const frame = frames?.find(frame => frame.url && new URL(frame.url).hostname.endsWith(".read.libbyapp.com"));
      return frame?.frameId;
    },
    extraScripts: ["js/content/libbyapp.js"]
  },

  // default -------------------------------------------------------------------
  {
    match: () => true
  }
];

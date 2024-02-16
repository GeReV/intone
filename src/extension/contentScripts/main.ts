/* eslint-disable no-console */
import { onMessage, sendMessage } from "webext-bridge/content-script";
import { lazy } from "~/utils/lazy";

const player = lazy(async () => {
  const { Player } = await import("../player/player");

  return new Player(false);
});

// Firefox `browser.tabs.executeScript()` requires scripts return a primitive value
(() => {
  // onMessage("get-required-js", () => getRequireJs());
  onMessage("play-text", async (message) => (await player()).playText(message.data.text, message.data.opts));
  onMessage("play-tab", async () => (await player()).playTab());
  onMessage("stop", async () => (await player()).stop());
  onMessage("pause", async () => (await player()).pause());
  onMessage("resume", async () => (await player()).resume());
  onMessage("forward", async () => (await player()).forward());
  onMessage("rewind", async () => (await player()).rewind());
  onMessage("seek", async (message) => (await player()).seek(message.data.n));
  onMessage("get-playback-state", async () => (await player()).getPlaybackState());
  onMessage("close", () => {
    close();
  });

  void sendMessage("register", null);

  // function getRequireJs() {
  //   if (location.hostname === "docs.google.com") {
  //     if (location.pathname.startsWith("/presentation/d/")) {
  //       return ["js/content/google-slides.js"];
  //     } else if (location.pathname.includes("/document/d/")) {
  //       return ["js/content/googleDocsUtil.js", "js/content/google-doc.js"];
  //     } else if (document.querySelector(".drive-viewer-paginated-scrollable")) {
  //       return ["js/content/google-drive-doc.js"];
  //     } else {
  //       return ["js/content/html-doc.js"];
  //     }
  //   } else if (location.hostname === "drive.google.com") {
  //     if (document.querySelector(".drive-viewer-paginated-scrollable")) {
  //       return ["js/content/google-drive-doc.js"];
  //     } else {
  //       return ["js/content/google-drive-preview.js"];
  //     }
  //   } else if (location.hostname === "onedrive.live.com" && document.querySelector(".OneUp-pdf--loaded")) {
  //     return ["js/content/onedrive-doc.js"];
  //   } else if (location.hostname.startsWith("read.amazon.")) {
  //     return ["js/content/kindle-book.js"];
  //   } else if (location.hostname.endsWith(".khanacademy.org")) {
  //     return ["js/content/khan-academy.js"];
  //   } else if (location.hostname.endsWith("acrobatiq.com")) {
  //     return ["js/content/html-doc.js", "js/content/acrobatiq.js"];
  //   } else if (location.hostname === "digital.wwnorton.com") {
  //     return ["js/content/html-doc.js", "js/content/wwnorton.js"];
  //   } else if (location.hostname === "plus.pearson.com") {
  //     return ["js/content/html-doc.js", "js/content/pearson.js"];
  //   } else if (location.hostname === "www.ixl.com") {
  //     return ["js/content/ixl.js"];
  //   } else if (location.hostname === "www.webnovel.com" && location.pathname.startsWith("/book/")) {
  //     return ["js/content/webnovel.js"];
  //   } else if (location.hostname === "archiveofourown.org") {
  //     return ["js/content/archiveofourown.js"];
  //   } else if (location.pathname.endsWith("readout.html") || location.pathname.endsWith(".pdf") || !!document.querySelector("embed[type='application/pdf']") || !!document.querySelector("iframe[src*='.pdf']")) {
  //     return ["js/content/pdf-doc.js"];
  //   } else if (/^\d+\.\d+\.\d+\.\d+$/.test(location.hostname)
  //     && location.port === "1122"
  //     && location.protocol === "http:"
  //     && location.pathname === "/bookshelf/index.html") {
  //     return ["js/content/yd-app-web.js"];
  //   } else {
  //     return ["js/content/html-doc.js"];
  //   }
  // }
})();


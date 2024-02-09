/* eslint-disable no-console */
import browser from "webextension-polyfill";
import { getSettings } from "~/logic/settings";
import { getSilenceTrack } from "~/utils/audio";
import { lazy } from "~/utils/lazy";

// import "./style.css";

const player = lazy(async () => {
  const { Player } = await import("../player/player");

  return new Player(false);
});

// Firefox `browser.tabs.executeScript()` requires scripts return a primitive value
(() => {
  console.log("cs register");

  browser.runtime.onMessage.addListener(listener);
  void browser.runtime.sendMessage({ type: "register", dest: "background" });

  async function listener(message) {
    console.log("cs message", message);

    // if (message.dest !==="content-script") {
    //   return;
    // }

    switch (message.type) {
      case "get-required-js":
        return getRequireJs();
      case "play-text":
        return (await player()).playText(message.data.text, message.data.opts);
      case "play-tab":
        return (await player()).playTab();
      case "stop":
        await (await player()).stop();
        break;
      case "pause":
        await (await player()).pause();
        break;
      case "resume":
        await (await player()).resume();
        break;
      case "forward":
        await (await player()).forward();
        break;
      case "rewind":
        await (await player()).rewind();
        break;
      case "seek":
        await (await player()).seek(message.data.n);
        break;
      case "close":
        close();
        break;
      case "get-playback-state":
        return (await player()).getPlaybackState();
    }
  }

  function getRequireJs() {
    if (location.hostname === "docs.google.com") {
      if (location.pathname.startsWith("/presentation/d/")) {
        return ["js/content/google-slides.js"];
      } else if (location.pathname.includes("/document/d/")) {
        return ["js/content/googleDocsUtil.js", "js/content/google-doc.js"];
      } else if (document.querySelector(".drive-viewer-paginated-scrollable")) {
        return ["js/content/google-drive-doc.js"];
      } else {
        return ["js/content/html-doc.js"];
      }
    } else if (location.hostname === "drive.google.com") {
      if (document.querySelector(".drive-viewer-paginated-scrollable")) {
        return ["js/content/google-drive-doc.js"];
      } else {
        return ["js/content/google-drive-preview.js"];
      }
    } else if (location.hostname === "onedrive.live.com" && document.querySelector(".OneUp-pdf--loaded")) {
      return ["js/content/onedrive-doc.js"];
    } else if (location.hostname.startsWith("read.amazon.")) {
      return ["js/content/kindle-book.js"];
    } else if (location.hostname.endsWith(".khanacademy.org")) {
      return ["js/content/khan-academy.js"];
    } else if (location.hostname.endsWith("acrobatiq.com")) {
      return ["js/content/html-doc.js", "js/content/acrobatiq.js"];
    } else if (location.hostname === "digital.wwnorton.com") {
      return ["js/content/html-doc.js", "js/content/wwnorton.js"];
    } else if (location.hostname === "plus.pearson.com") {
      return ["js/content/html-doc.js", "js/content/pearson.js"];
    } else if (location.hostname === "www.ixl.com") {
      return ["js/content/ixl.js"];
    } else if (location.hostname === "www.webnovel.com" && location.pathname.startsWith("/book/")) {
      return ["js/content/webnovel.js"];
    } else if (location.hostname === "archiveofourown.org") {
      return ["js/content/archiveofourown.js"];
    } else if (location.pathname.endsWith("readaloud.html") || location.pathname.endsWith(".pdf") || !!document.querySelector("embed[type='application/pdf']") || !!document.querySelector("iframe[src*='.pdf']")) {
      return ["js/content/pdf-doc.js"];
    } else if (/^\d+\.\d+\.\d+\.\d+$/.test(location.hostname)
      && location.port === "1122"
      && location.protocol === "http:"
      && location.pathname === "/bookshelf/index.html") {
      return ["js/content/yd-app-web.js"];
    } else {
      return ["js/content/html-doc.js"];
    }
  }

  void getSettings()
    .then(settings => {
      if (settings.fixBtSilenceGap) {
        setInterval(updateSilenceTrack.bind(null, Math.random()), 5000);
      }
    });

  const audioCanPlay = () => navigator.userActivation.hasBeenActive;

  async function updateSilenceTrack(providerId: number) {
    if (!audioCanPlay()) {
      return;
    }

    const silenceTrack = getSilenceTrack();

    try {
      const should = await browser.runtime.sendMessage({ type: "should-play-silence", data: { providerId } });
      if (should) {
        silenceTrack.start();
      } else {
        silenceTrack.stop();
      }
    } catch (err) {
      silenceTrack.stop();
    }
  }
})();


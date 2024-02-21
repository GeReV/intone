import { $ } from "~/utils/dom";
import * as browser from "webextension-polyfill";
import { DEFAULT_SETTINGS, getSettings, Settings, updateSettings } from "~/utils/settings";
import type { DataTypeKey, GetDataType, GetReturnType } from "webext-bridge";
import assert from "~/utils/assert";
import { escapeHtml, getQueryString, nextId } from "~/utils";
import { PermissionsError } from "~/utils/errors";
import { formatError, getActiveTab } from "~/utils/webext";
import { sendMessage } from "webext-bridge/popup";

const queryString = getQueryString();

// const playbackErrorProcessor = {
//   lastError: {},
//   next: function (err) {
//     if (err.message != this.lastError.message) {
//       this.lastError = err;
//       handleError(err);
//     }
//   }
// };

const sendMessageBackground = async <K extends DataTypeKey>(messageId: K, data: GetDataType<K, never>): Promise<GetReturnType<K, never>> =>
  sendMessage(messageId, data, "background");

export class Popup {
  private readonly status: HTMLElement;
  private readonly highlight: HTMLElement;
  private readonly toolbar: HTMLElement;
  private readonly loadingIndicator: HTMLElement;
  private readonly btnPlay: HTMLButtonElement;
  private readonly btnPause: HTMLButtonElement;
  private readonly btnStop: HTMLButtonElement;
  private readonly btnSettings: HTMLButtonElement;
  private readonly btnForward: HTMLButtonElement;
  private readonly btnRewind: HTMLButtonElement;
  private readonly btnDecreaseFontSize: HTMLButtonElement;
  private readonly btnIncreaseFontSize: HTMLButtonElement;
  private readonly btnDecreaseWindowSize: HTMLButtonElement;
  private readonly btnIncreaseWindowSize: HTMLButtonElement;

  private currentPlayRequestId = 0;

  private texts: string[] = [];
  private currentIndex = -1;

  constructor() {
    this.status = $<HTMLElement>("#status");
    this.highlight = $<HTMLElement>("#highlight");
    this.toolbar = $<HTMLElement>("#toolbar");
    this.loadingIndicator = $<HTMLElement>("#imgLoading");
    this.btnPlay = $<HTMLButtonElement>("#btn-play");
    this.btnPause = $<HTMLButtonElement>("#btn-pause");
    this.btnStop = $<HTMLButtonElement>("#btn-stop");
    this.btnSettings = $<HTMLButtonElement>("#btn-settings");
    this.btnForward = $<HTMLButtonElement>("#btn-forward");
    this.btnRewind = $<HTMLButtonElement>("#btn-rewind");
    this.btnDecreaseFontSize = $<HTMLButtonElement>("#decrease-font-size");
    this.btnIncreaseFontSize = $<HTMLButtonElement>("#increase-font-size");
    this.btnDecreaseWindowSize = $<HTMLButtonElement>("#decrease-window-size");
    this.btnIncreaseWindowSize = $<HTMLButtonElement>("#increase-window-size");

    this.btnPlay.addEventListener("click", this.onPlay.bind(this), false);
    this.btnPause.addEventListener("click", this.onPause.bind(this), false);
    this.btnStop.addEventListener("click", this.onStop.bind(this), false);
    this.btnSettings.addEventListener("click", this.onSettings.bind(this), false);
    this.btnForward.addEventListener("click", this.onForward.bind(this), false);
    this.btnRewind.addEventListener("click", this.onRewind.bind(this), false);
    this.btnDecreaseFontSize.addEventListener("click", this.changeFontSize.bind(null, -1), false);
    this.btnIncreaseFontSize.addEventListener("click", this.changeFontSize.bind(null, +1), false);
    this.btnDecreaseWindowSize.addEventListener("click", this.changeWindowSize.bind(null, -1), false);
    this.btnIncreaseWindowSize.addEventListener("click", this.changeWindowSize.bind(null, +1), false);
  }

  async init() {
    try {
      await this.updateButtons();

      const settings = await getSettings(["showHighlighting", "readOutTab"]);

      if (settings.showHighlighting === 2 && queryString.has("isPopup")) {
        const activeTab = await getActiveTab();
        const url = browser.runtime.getURL(`popup.html?tab=${activeTab?.id}`);

        if (settings.readOutTab) {
          const tab = await browser.tabs.update(settings.readOutTab, { url: url, active: true });

          if (tab.windowId) {
            await browser.windows.update(tab.windowId, { focused: true });
          }
        } else {
          await browser.windows.create({
            url: url,
            focused: true,
            type: "popup",
            width: 500,
            height: 600,
          });
        }

        window.close();
      } else {
        const stateInfo = await sendMessageBackground("get-playback-state", null);

        if (stateInfo.state === "PAUSED" || stateInfo.state === "STOPPED") {
          this.btnPlay.click();
        }
      }

      setInterval(() => {
        void this.updateButtons();
      }, 500);

      await this.refreshSize();
    } catch (err) { /* empty */
    }
  }

  private async updateButtons() {
    try {
      const [settings, stateInfo] = await Promise.all([
        getSettings(),
        sendMessageBackground("get-playback-state", null)
      ]);

      const { state, speechPosition, playbackError } = stateInfo;

      if (playbackError) {
        // playbackErrorProcessor.next(playbackError);
      }

      this.loadingIndicator.hidden = state !== "LOADING";
      this.btnSettings.hidden = state !== "STOPPED";
      this.btnPlay.hidden = state !== "PAUSED" && state !== "STOPPED";
      this.btnPause.hidden = state !== "PLAYING";
      this.btnStop.hidden = state !== "PAUSED" && state !== "PLAYING" && state !== "LOADING";
      this.btnForward.hidden = this.btnRewind.hidden = state !== "PLAYING" && state !== "PAUSED";
      this.highlight.hidden = this.toolbar.hidden = !(typeof settings.showHighlighting !== "undefined" ? settings.showHighlighting : DEFAULT_SETTINGS.showHighlighting) && (state === "LOADING" || state === "PAUSED" || state === "PLAYING");

      if ((typeof settings.showHighlighting !== "undefined" ? settings.showHighlighting : DEFAULT_SETTINGS.showHighlighting) && speechPosition) {
        const pos = speechPosition;
        const elem = this.highlight;
        if (this.texts.length !== pos.texts.length || this.texts.some((text, i) => text !== pos.texts[i])) {
          this.texts = pos.texts;
          this.currentIndex = -1;

          elem.dir = pos.isRTL ? "rtl" : "ltr";
          elem.style.direction = pos.isRTL ? "rtl" : "";

          while (elem.firstChild) {
            elem.removeChild(elem.firstChild);
          }

          for (let i = 0; i < pos.texts.length; i++) {
            const html = escapeHtml(pos.texts[i] ?? "").replace(/\r?\n/g, "<br/>");

            const span = document.createElement("span");
            span.innerHTML = html;
            span.addEventListener("click", this.onSeek.bind(this, i), false);

            elem.appendChild(span);
          }
        }

        if (this.currentIndex !== pos.index) {
          this.currentIndex = pos.index;

          elem.querySelectorAll(".active").forEach(el => {
            el.classList.remove("active");
          });

          const child = elem.children.item(pos.index);

          if (child) {
            child.classList.add("active");

            child.scrollIntoView({
              behavior: "smooth"
            });
          }
        }
      }
    } catch (err) {
      if (err instanceof Error) {
        this.status.hidden = false;
        this.status.textContent = err.message;
      }

      console.error(err);
    }
  }

  private async onPlay() {
    this.status.hidden = true;

    const requestId = this.currentPlayRequestId = nextId();

    try {
      const stateInfo = await sendMessageBackground("get-playback-state", null);

      if (stateInfo.state === "PAUSED") {
        await sendMessageBackground("resume", null);
      } else {
        await sendMessageBackground("play-tab", { tabId: queryString.has("tab") ? Number(queryString.get("tab")) : undefined });
      }

      await this.updateButtons();
    } catch (err) {
      if (requestId === this.currentPlayRequestId) {
        this.handleError(err);
      } else {
        console.debug("Ignoring error from an earlier request", err);
      }
    }
  }

  private async reloadAndPlay() {
    this.status.hidden = true;

    try {
      await sendMessageBackground("reload-and-play-tab", { tabId: queryString.has("tab") ? Number(queryString.get("tab")) : undefined });

      await this.updateButtons();
    } catch (err) {
      this.handleError(err);
    }
  }

  private async onPause() {
    try {
      await sendMessageBackground("pause", null);

      await this.updateButtons();
    } catch (err) {
      this.handleError(err);
    }
  }

  private async onStop() {
    try {
      await sendMessageBackground("stop", null);
      await this.updateButtons();
    } catch (err) {
      this.handleError(err);
    }
  }

  private onSettings() {
    location.href = browser.runtime.getURL("dist/options/index.html");
  }

  private async onForward() {
    try {
      await sendMessageBackground("forward", null);

      await this.updateButtons();
    } catch (err) {
      this.handleError(err);
    }
  }

  private async onRewind() {
    try {
      await sendMessageBackground("rewind", null);
      await this.updateButtons();
    } catch (err) {
      this.handleError(err);
    }
  }

  private async onSeek(n: number) {
    try {
      await sendMessageBackground("seek", { n });
    } catch (err) {
      this.handleError(err);
    }
  }

  private async changeFontSize(delta: 1 | -1) {
    try {
      const settings = await getSettings(["highlightFontSize"]);

      const newSize = (settings.highlightFontSize ?? DEFAULT_SETTINGS.highlightFontSize) + delta;
      if (newSize >= 1 && newSize <= 8) {
        await updateSettings({ highlightFontSize: newSize });
        await this.refreshSize();
      }
    } catch (err) {
      this.handleError(err);
    }
  }

  private async changeWindowSize(delta: 1 | -1) {
    try {
      const settings = await getSettings(["highlightWindowSize"]);

      const newSize = (settings.highlightWindowSize ?? DEFAULT_SETTINGS.highlightWindowSize) + delta;

      if (newSize >= 1 && newSize <= 3) {
        await updateSettings({ highlightWindowSize: newSize });

        await this.refreshSize();
      }
    } catch (err) {
      this.handleError(err);
    }
  }

  private async refreshSize() {
    const settings = await getSettings(["highlightFontSize", "highlightWindowSize"]);

    const fontSize = getFontSize(settings);
    const windowSize = getWindowSize(settings);

    this.highlight.style.fontSize = fontSize;

    if (queryString.has("isPopup")) {
      this.highlight.style.width = `${windowSize[0]}px`;
      this.highlight.style.height = `${windowSize[1]}px`;
    }

    function getFontSize(settings: Partial<Settings>) {
      switch (settings.highlightFontSize ?? DEFAULT_SETTINGS.highlightFontSize) {
        case 1:
          return ".9em";
        case 2:
          return "1em";
        case 3:
          return "1.1em";
        case 4:
          return "1.2em";
        case 5:
          return "1.3em";
        case 6:
          return "1.4em";
        case 7:
          return "1.5em";
        default:
          return "1.6em";
      }
    }

    function getWindowSize(settings: Partial<Settings>): [number, number] {
      switch (settings.highlightWindowSize ?? DEFAULT_SETTINGS.highlightWindowSize) {
        case 1:
          return [430, 330];
        case 2:
          return [550, 420];
        default:
          return [750, 450];
      }
    }
  }

  private handleError(err: unknown) {
    if (!(err instanceof Error)) return;

    if (err instanceof PermissionsError) {
      this.status.innerHTML = formatError(err);
      this.status.hidden = false;

      const link = this.status.querySelector("a");

      link?.addEventListener("click", async () => {
        assert(link);

        switch (link.href) {
          case "#open-extension-settings":
            await browser.tabs.create({ url: `chrome://extensions/?id=${browser.runtime.id}` });
            break;
          case "#request-permissions": {
            const granted = await browser.permissions.request(err.perms);

            if (granted) {
              if (err.reload) {
                await this.reloadAndPlay();
              } else {
                this.btnPlay.click();
              }
            }
          }
            break;
          case "#open-pdf-viewer":
            // await browser.tabs.create({ url: config.pdfViewerUrl });
            break;
        }
      }, false);
    } else {
      this.status.textContent = err.message;
      this.status.hidden = false;
    }
  }
}
import browser from "webextension-polyfill";

type ContentMessage = { type: "play" | "stop" | "forward" | "rewind" | "play-selection"; text?: string }
type TtsFetchMessage = { type: "tts-fetch"; url: string }
type TtsFetchResponse = { buffer: ArrayBuffer; contentType: string } | { error: string }

type BgFetchMessage = { type: "bg-fetch"; url: string; method?: string }
type BgFetchResponse = { ok: boolean; status: number; json?: unknown; error?: string }

async function getActiveTab(): Promise<browser.Tabs.Tab | undefined> {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true });
  return tab;
}

async function send(tabId: number, message: ContentMessage): Promise<void> {
  try {
    await browser.tabs.sendMessage(tabId, message);
  } catch (err) {
    if (!(err instanceof Error) || !err.message.includes('Receiving end does not exist')) {
      return;
    }
    try {
      await browser.scripting.executeScript({
        target: { tabId },
        files: ['dist/contentScripts/index.js'],
      });
      await browser.tabs.sendMessage(tabId, message);
    } catch {
      // Restricted page (chrome://, etc.) — silently ignore
    }
  }
}

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: "read-selection",
    title: browser.i18n.getMessage("context_read_selection") || "Read selection",
    contexts: ["selection"],
  });
});

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "read-selection" && tab?.id) {
    void send(tab.id, { type: "play-selection", text: info.selectionText });
  }
});

browser.action.onClicked.addListener((tab) => {
  if (tab.id) {
    void send(tab.id, { type: "play" });
  }
});

browser.commands.onCommand.addListener(async (command) => {
  const tab = await getActiveTab();
  if (!tab?.id) {
    return;
  }

  if (command === "play" || command === "stop" || command === "forward" || command === "rewind") {
    void send(tab.id, { type: command });
  }
});

browser.runtime.onMessage.addListener((raw: unknown): Promise<TtsFetchResponse | BgFetchResponse> | undefined => {
  const msg = raw as TtsFetchMessage | BgFetchMessage;

  switch (msg.type) {
    case "tts-fetch":
      return fetch(msg.url)
        .then(async (res) => {
          if (!res.ok) {
            throw new Error(`TTS server responded with ${res.status}`);
          }
          const contentType = res.headers.get("content-type") ?? "audio/ogg";
          const buffer = await res.arrayBuffer();
          return { buffer, contentType };
        })
        .catch((err: unknown) => {
          console.error("[Read Out] tts-fetch failed", msg.url, err);
          return { error: err instanceof Error ? err.message : String(err) };
        });
    case "bg-fetch":
      return fetch(msg.url, { method: msg.method ?? "GET" })
        .then(async (res) => {
          const json = res.ok ? ((await res.json()) as unknown) : undefined;
          return { ok: res.ok, status: res.status, json };
        })
        .catch((err: unknown) => {
          console.error("[Read Out] bg-fetch failed", msg.url, err);
          return { ok: false, status: 0, error: err instanceof Error ? err.message : String(err) };
        });
    default:
      return undefined;
  }
});

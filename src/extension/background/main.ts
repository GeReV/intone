import browser from "webextension-polyfill";
import { onMessage, sendMessage } from "webext-bridge/background";
import { TaskSingleton } from "~/background/task";
import { detectTabLanguage, getActiveTab } from "~/utils/webext";
import { updateSettings } from "~/utils/settings";
import { CONTENT_HANDLERS } from "~/background/contentHandlers";
import assert from "~/utils/assert";
import AwaitableSet from "~/utils/awaitableSet";
import { DataTypeKey, GetDataType, GetReturnType } from "webext-bridge";

// only on dev mode
if (import.meta.hot) {
  // @ts-expect-error for background HMR
  import("/@vite/client");
  // load latest content script
  import("./contentScriptHMR");
}

browser.runtime.onInstalled.addListener((): void => {
  // eslint-disable-next-line no-console
  console.log("Extension installed");

  installContextMenus();
});

/**
 * Installers
 */

function installContextMenus() {
  browser.contextMenus.create({
      id: "read-selection",
      title: browser.i18n.getMessage("context_read_selection"),
      contexts: ["selection"]
    },
    function () {
      if (browser.runtime.lastError) {
        console.error(browser.runtime.lastError);
      } else {
        console.info("Installed context menus");
      }
    });

  browser.contextMenus.onClicked.addListener(async (info, tab) => {
    try {
      if (info.menuItemId === "read-selection") {
        const lang = (tab && tab.id !== -1) ? await detectTabLanguage(tab.id) : undefined;

        await playText(info.selectionText, { lang });
      }
    } catch (err) {
      handleHeadlessError(err);
    }
  });
}

browser.commands.onCommand.addListener(async (command) => {
  try {
    switch (command) {
      case "play": {
        const stateInfo = await getPlaybackState();

        switch (stateInfo.state) {
          case "PLAYING":
            await pause();
            break;
          case "PAUSED":
            await resume();
            break;
          case "STOPPED":
            await playTab();
            break;
        }
        break;
      }
      case "stop":
        await stop();
        break;
      case "forward":
        await forward();
        break;
      case "rewind":
        await rewind();
        break;
      default:
        break;
    }
  } catch (err) {
    handleHeadlessError(err);
  }
});

let sendToPlayer: <K extends DataTypeKey>(messageId: K, data: GetDataType<K, null>) => Promise<GetReturnType<K, never>>;

const currentTask = new TaskSingleton();

const tabRegistry = new AwaitableSet<number>();

async function readyContentScript(tabId: number) {
  await tabRegistry.waitFor(tabId);
}

browser.tabs.onRemoved.addListener((tabId) => {
  tabRegistry.delete(tabId);
});

// see shim.d.ts for type declaration
onMessage("register", (message) => {
  tabRegistry.add(message.sender.tabId);
});
onMessage("play-text", (message) => playText(message.data.text, message.data.opts));
onMessage("play-tab", message => playTab(message.data.tabId));
onMessage("reload-and-play-tab", message => reloadAndPlayTab(message.data.tabId));
onMessage("stop", stop);
onMessage("pause", pause);
onMessage("resume", resume);
onMessage("forward", forward);
onMessage("rewind", rewind);
onMessage("seek", (message) => seek(message.data));
onMessage("get-playback-state", getPlaybackState);


async function playText(text: string | undefined, opts: { lang: string | undefined }) {
  const hasPlayer = await stop();
  if (!hasPlayer) {
    const tab = await getActiveTab();

    assert(tab?.id);

    await readyContentScript(tab.id);

    sendToPlayer = async <K extends DataTypeKey>(messageId: K, data: GetDataType<K, null>): Promise<GetReturnType<K, never>> => {
      assert(tab.id);

      console.log("sending cs", messageId, data);

      return await sendMessage(messageId, data, `content-script@${tab.id}`);
    };
  }

  await sendToPlayer("play-text", { text, opts });
}

async function playTab(tabId?: number) {
  const tab = tabId ? await browser.tabs.get(tabId) : await getActiveTab();
  if (!tab) {
    throw new Error(JSON.stringify({ code: "error_page_unreadable" }));
  }

  assert(tab.id);

  await readyContentScript(tab.id);

  sendToPlayer = async <K extends DataTypeKey>(messageId: K, data: GetDataType<K, null>): Promise<GetReturnType<K, never>> => {
    assert(tab.id);

    return await sendMessage(messageId, data, `content-script@${tab.id}`);
  };

  const task = currentTask.begin();
  try {
    const handler = CONTENT_HANDLERS.find(h => h.match(tab.url ?? "", tab.title));

    if (handler?.validate) {
      await handler.validate(tab);
    }

    if (handler?.getSourceUri) {
      await updateSettings({ sourceUri: handler.getSourceUri(tab) });
    } else {
      // let frameId;
      // if (handler?.getFrameId && typeof tab.id !== "undefined") {
      //   const frames = await browser.webNavigation.getAllFrames({ tabId: tab.id });
      //
      //   frameId = handler.getFrameId(frames);
      // }
      //
      // if (!await contentScriptAlreadyInjected(tab, frameId)) {
      //   await injectContentScript(tab, frameId, handler?.extraScripts);
      // }

      await updateSettings({ sourceUri: `contentscript:${tab.id}` });
    }
  } catch (e) {
    console.error(e);
  } finally {
    task.end();
  }

  await sendToPlayer("play-tab", {});
}

async function reloadAndPlayTab(tabId?: number) {
  const tab = tabId ? await browser.tabs.get(tabId) : await getActiveTab();
  if (!tab) {
    throw new Error(JSON.stringify({ code: "error_page_unreadable" }));
  }

  const task = currentTask.begin();
  try {
    const tabLoadComplete = new Promise<void>((resolve) => {
      function listener(changeTabId: number, changeInfo: browser.Tabs.OnUpdatedChangeInfoType) {
        if (changeTabId === tab?.id && changeInfo.status === "complete") {
          browser.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }

      browser.tabs.onUpdated.addListener(listener);
    });

    await browser.tabs.reload(tab.id);
    await tabLoadComplete;
  } finally {
    task.end();
  }

  await playTab(tabId);
}

async function stop() {
  currentTask.cancel();
  return sendToPlayer("stop", null);
}

async function pause() {
  return sendToPlayer("pause", null);
}

async function resume() {
  return sendToPlayer("resume", null);
}

async function forward() {
  return sendToPlayer("forward", null);
}

async function rewind() {
  return sendToPlayer("rewind", null);
}

async function seek(data: { n: number }) {
  return sendToPlayer("seek", data);
}

async function getPlaybackState(): Promise<GetReturnType<"get-playback-state">> {
  if (currentTask.isActive()) {
    return { state: "LOADING" };
  }

  try {
    return await sendToPlayer("get-playback-state", null);
  } catch (err) {
    return { state: "STOPPED" };
  }
}

function handleHeadlessError(err: unknown) {
  //TODO: let user knows somehow
  console.error(err);
}

// async function contentScriptAlreadyInjected(tab: browser.Tabs.Tab, frameId: number | undefined) {
//   if (typeof tab.id === "undefined") {
//     throw new Error("Expected tab ID");
//   }
//
//   const items = await browser.scripting.executeScript({
//     target: {
//       tabId: tab.id,
//       frameIds: frameId ? [frameId] : undefined,
//     },
//     func: function () {
//       return document.getElementById(__NAME__) !== null;
//     }
//   });
//
//   return items[0]?.result === true;
// }
//
// async function injectContentScript(tab: browser.Tabs.Tab, frameId: number | undefined, extraScripts: string[] | undefined) {
//   assert(tab.id, "Expected tab ID");
//
//   const files = extraScripts ?? await sendMessage("get-required-js", null, `content-script@${tab.id}`);
//
//   await browser.scripting.executeScript({
//     target: {
//       tabId: tab.id,
//       frameIds: frameId ? [frameId] : undefined,
//     },
//     files,
//   });
//
//   console.info("Content handler", files);
// }
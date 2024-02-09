import type { Tabs } from "webextension-polyfill";
import * as browser from "webextension-polyfill";
import { PermissionsError } from "~/logic";

export async function getActiveTab(): Promise<Tabs.Tab | undefined> {
  const [tab,] = await browser.tabs.query({ active: true, lastFocusedWindow: true });

  return tab;
}

export function formatError(err: PermissionsError) {
  let message = browser.i18n.getMessage(err.code) || err.code;
  if (message) {
    message = message
      .replace(/\{(\w+)}/g, function (m, p1: string) {
        if (Object.hasOwn(err, p1)) {
          const prop = Object.getOwnPropertyDescriptor(err, p1);

          return String(prop?.value);
        }

        return `{${m}}`;
      })
      .replace(/\[(.*?)]\((.*?)\)/g, "<a href=\"#$2\">$1</a>");
  }
  return message;
}

export async function detectTabLanguage(tabId?: number) {
  try {
    const lang = await browser.tabs.detectLanguage(tabId);

    if (lang === "und") {
      return undefined;
    }

    return lang;
  } catch (err) {
    console.error(err);
    return undefined;
  }
}
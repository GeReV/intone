# Design: First-Click Content Script Injection

**Date:** 2026-05-19

## Problem

Content scripts declared in the manifest are injected at page load time. Tabs already open when the extension is installed or reloaded do not receive the content script. The first toolbar button click sends a `play` message that fails silently, so nothing happens. The user must refresh the tab before the extension works.

## Behavior

- **First click on an uninjected tab** → inject content script, then send `play` → UI appears and playback starts
- **Subsequent clicks** → `sendMessage` succeeds immediately, no injection needed, existing toggle behavior unchanged
- **Restricted pages** (`chrome://`, `edge://`, etc.) → injection fails → silently ignored, same as before

## Implementation

### `src/extension/manifest.ts`

Add `"scripting"` to the `permissions` array. The existing `activeTab` permission already grants temporary access to the active tab, so no additional host permissions are required.

### `src/extension/background/main.ts`

Replace the `send()` function with a catch-and-inject version:

```ts
async function send(tabId: number, message: ContentMessage): Promise<void> {
  try {
    await browser.tabs.sendMessage(tabId, message);
  } catch {
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
```

`browser.scripting.executeScript` resolves only after the injected script has fully executed, guaranteeing the message listener is registered before the re-send. No double-injection risk: if the content script is already present, `sendMessage` succeeds and the injection branch is never reached.

## Out of Scope

- Keyboard shortcut commands (`play`, `stop`, `forward`, `rewind`) — keep existing silent-fail behavior

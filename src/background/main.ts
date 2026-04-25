import browser from 'webextension-polyfill'

type ContentMessage = { type: 'play' | 'stop' | 'forward' | 'rewind' | 'play-selection'; text?: string }

browser.runtime.onInstalled.addListener(() => {
  browser.contextMenus.create({
    id: 'read-selection',
    title: browser.i18n.getMessage('context_read_selection') || 'Read selection',
    contexts: ['selection'],
  })
})

browser.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'read-selection' && tab?.id) {
    void send(tab.id, { type: 'play-selection', text: info.selectionText })
  }
})

browser.action.onClicked.addListener((tab) => {
  if (tab.id) void send(tab.id, { type: 'play' })
})

browser.commands.onCommand.addListener(async (command) => {
  const tab = await getActiveTab()
  if (!tab?.id) return
  if (command === 'play' || command === 'stop' || command === 'forward' || command === 'rewind') {
    void send(tab.id, { type: command })
  }
})

async function getActiveTab(): Promise<browser.Tabs.Tab | undefined> {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })
  return tab
}

async function send(tabId: number, message: ContentMessage): Promise<void> {
  try {
    await browser.tabs.sendMessage(tabId, message)
  }
  catch {
    // Tab may not have the content script yet (e.g. chrome:// pages)
  }
}

import browser from "webextension-polyfill";

export type Settings = {
  serverUrl: string
  voiceName: string
  extractor: "readability"
  rate: number
  volume: number
  showPreview: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  serverUrl: "https://localhost:5000",
  voiceName: "af",
  extractor: "readability",
  rate: 1.0,
  volume: 1.0,
  showPreview: true,
};

export async function getSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(Object.keys(DEFAULT_SETTINGS));
  return { ...DEFAULT_SETTINGS, ...(stored as Partial<Settings>) };
}

export async function saveSettings(settings: Partial<Settings>): Promise<void> {
  await browser.storage.local.set(settings);
}

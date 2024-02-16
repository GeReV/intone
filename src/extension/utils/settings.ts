// import { storage } from "webextension-polyfill";

import browser from "webextension-polyfill";

export type Settings = {
  voiceName: string | undefined;
  preferredVoices: Record<string, string>;
  serverUrl: string | undefined;
  rate: number;
  volume: number;
  showHighlighting: number;
  languages: string[];
  highlightFontSize: number;
  highlightWindowSize: number;
  useEmbeddedPlayer: boolean;
  readOutTab: number | undefined;
  sourceUri: string | undefined;
};

export type SettingsKey = keyof Settings;

export const DEFAULT_SETTINGS = {
  rate: 1.0,
  volume: 1.0,
  showHighlighting: 1,
  highlightFontSize: 3,
  highlightWindowSize: 2,
  useEmbeddedPlayer: true,
} as const;

export async function getSettings(settings: SettingsKey[] = ["voiceName", "rate", "volume", "showHighlighting", "languages", "highlightFontSize", "highlightWindowSize", "preferredVoices", "serverUrl", "useEmbeddedPlayer"]): Promise<Partial<Settings>> {
  return browser.storage.local.get(settings);
}

export async function updateSettings(settings: Partial<Settings>): Promise<void> {
  return browser.storage.local.set(settings);
}

export async function clearSettings(settings: SettingsKey[] = ["voiceName", "rate", "volume", "showHighlighting", "languages", "highlightFontSize", "highlightWindowSize", "preferredVoices", "serverUrl", "useEmbeddedPlayer"]): Promise<void> {
  return browser.storage.local.remove(settings);
}
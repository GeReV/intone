// import { storage } from "webextension-polyfill";

import browser from "webextension-polyfill";

export type Settings = {
  voiceName: string | undefined;
  preferredVoices: Record<string, string>;
  serverUrl: string | undefined;
  rate: number;
  pitch: number;
  volume: number;
  showHighlighting: number;
  languages: string[];
  highlightFontSize: number;
  highlightWindowSize: number;
  useEmbeddedPlayer: boolean;
  fixBtSilenceGap: boolean;
  readAloudTab: number | undefined;
  sourceUri: string | undefined;
};

export type SettingsKey = keyof Settings;

export const DEFAULTS = {
  rate: 1.0,
  pitch: 1.0,
  volume: 1.0,
  showHighlighting: 1,
  highlightFontSize: 3,
  highlightWindowSize: 2,
  useEmbeddedPlayer: true,
} as const;

export async function getSettings(settings: SettingsKey[] = ["voiceName", "rate", "pitch", "volume", "showHighlighting", "languages", "highlightFontSize", "highlightWindowSize", "preferredVoices", "serverUrl", "useEmbeddedPlayer", "fixBtSilenceGap"]): Promise<Partial<Settings>> {
  return browser.storage.local.get(settings);
}

export async function updateSettings(settings: Partial<Settings>): Promise<void> {
  return browser.storage.local.set(settings);
}

export async function clearSettings(settings: SettingsKey[] = ["voiceName", "rate", "pitch", "volume", "showHighlighting", "languages", "highlightFontSize", "highlightWindowSize", "preferredVoices", "serverUrl", "useEmbeddedPlayer", "fixBtSilenceGap"]): Promise<void> {
  return browser.storage.local.remove(settings);
}
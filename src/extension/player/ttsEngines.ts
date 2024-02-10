export type TtsOptions = {
  rate: number;
  rateAdjust?: number;
  pitch: number;
  volume: number;
  lang: string;
  voice: string;
}

export type AudioHelper = {
  startPromise: Promise<void>;
  endPromise: Promise<void>;
  resume(): Promise<boolean>;
  pause(): void;
};

export type TtsEngineEvent = { type: "start" | "end", charIndex: number } | { type: "error", error: Error };
export type TtsEngineEventHandler = (evt: TtsEngineEvent) => void;

export type TtsVoice = {
  key: string;
  language: string;
  name: string;
};

export interface TtsEngine {
  speak(utterance: string, options: TtsOptions, onEvent: TtsEngineEventHandler): void;

  isSpeaking(): boolean;

  resume(): Promise<void>;

  stop(): void;

  pause(): void;

  setNextStartTime?: (time: number) => void;

  prefetch?: (utterance: string, options: TtsOptions) => void;

  preferredVoices(): Record<string, string>;

  getVoices(): Promise<TtsVoice[]>;
}



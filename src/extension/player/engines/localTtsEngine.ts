import { playAudio } from "~/player/audio";
import {
  AudioHelper,
  TtsEngine,
  TtsEngineEventHandler,
  TtsOptions,
  ttsOptionsEquals,
  TtsVoice
} from "~/player/ttsEngines";
import assert from "~/utils/assert";

type PrefetchedAudio = {
  createdAt: number;
  options: TtsOptions;
  url: string;
};

export default class LocalTtsEngine implements TtsEngine {
  static readonly PREFETCH_MAX_SIZE = 5;
  static readonly DEFAULT_URL = "http://localhost:5000";

  private audio: AudioHelper | null = null;
  private prefetches: Map<string, PrefetchedAudio> = new Map<string, PrefetchedAudio>();
  private speaking = false;

  readonly name = "Local TTS Engine";

  constructor(private readonly url: URL) {
  }

  async speak(utterance: string, options: TtsOptions, onEvent: TtsEngineEventHandler) {
    const prefetched = this.prefetches.get(utterance);

    let url;
    if (prefetched && ttsOptionsEquals(prefetched.options, options)) {
      url = prefetched.url;
    } else {
      const prefetch = await this.prefetch(utterance, options);

      url = prefetch.url;
    }

    this.audio = playAudio(url, options);
    this.audio.startPromise
      .then(() => {
        this.speaking = true;

        onEvent({ type: "start", charIndex: 0 });
      })
      .catch(err => {
        onEvent({ type: "error", error: err instanceof Error ? err : new Error(JSON.stringify(err)) });
      });
    this.audio.endPromise
      .then(() => {
          onEvent({ type: "end", charIndex: utterance.length });
        },
        err => {
          onEvent({ type: "error", error: err instanceof Error ? err : new Error(JSON.stringify(err)) });
        })
      .finally(() => {
        this.speaking = false;
      });
  }

  isSpeaking() {
    return this.speaking;
  }

  pause() {
    this.audio?.pause();
  }

  stop() {
    this.audio?.pause();
  }

  async resume() {
    await this.audio?.resume();
  }


  preferredVoices(): Record<string, string> {
    return {
      en: "default",
    };
  }

  getVoices(): Promise<TtsVoice[]> {
    return Promise.resolve([
      {
        key: "default",
        language: "en",
        name: "ryan"
      },
    ]);
  }

  private async getAudioUrl(text: string, voice: string, rate?: number): Promise<string> {
    assert(text && voice);

    const url = new URL(this.url);
    url.searchParams.set("text", text);

    if (typeof rate !== "undefined" && rate > 0) {
      url.searchParams.set("rate", String(rate));
    }

    const res = await fetch(url, {
      method: "GET",
    });

    if (!res.ok) {
      throw await res.text();
    }

    return URL.createObjectURL(await res.blob());
  }

  async prefetch(utterance: string, options: TtsOptions): Promise<PrefetchedAudio> {
    const url = await this.getAudioUrl(utterance, options.voice);

    const prefetch: PrefetchedAudio = {
      url,
      options,
      createdAt: Date.now(),
    };

    this.prefetches.set(utterance, prefetch);

    this.evictPrefetches();

    return prefetch;
  }

  private evictPrefetches() {
    while (this.prefetches.size > LocalTtsEngine.PREFETCH_MAX_SIZE) {
      let oldest: [string, PrefetchedAudio] | null = null;

      for (const entry of this.prefetches.entries()) {
        if (!oldest || oldest[1].createdAt > entry[1].createdAt) {
          oldest = entry;
        }
      }

      if (oldest) {
        URL.revokeObjectURL(oldest[1].url);

        this.prefetches.delete(oldest[0]);
      }
    }
  }
}


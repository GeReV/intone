import { AudioHelper, TtsEngine, TtsEngineEventHandler, TtsOptions, TtsVoice } from "~/player/ttsEngines";
import assert from "~/utils/assert";
import { playAudio } from "~/player/audio";

export default class PiperTtsEngine implements TtsEngine {
  private audio: AudioHelper | null = null;
  private prefetchAudio: [string, TtsOptions, string] | null = null;
  private speaking = false;

  static readonly DEFAULT_URL = "http://localhost:5000";

  readonly name = "Piper TTS Engine";

  constructor(private readonly url: URL) {
  }

  async speak(utterance: string, options: TtsOptions, onEvent: TtsEngineEventHandler) {
    const url = (this.prefetchAudio && this.prefetchAudio[0] === utterance && this.prefetchAudio[1] === options) ?
      this.prefetchAudio[2] :
      await this.getAudioUrl(utterance, options.voice, options.rate);

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
          console.log("audio end event");
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

  async prefetch(utterance: string, options: TtsOptions) {
    try {
      const url = await this.getAudioUrl(utterance, options.voice);
      this.prefetchAudio = [utterance, options, url];
    } catch (err) {
      console.error(err);
    }
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
}

import { AudioHelper, TtsEngine, TtsEngineEventHandler, TtsOptions, TtsVoice } from "~/player/ttsEngines";
import assert from "~/utils/assert";
import { playAudio } from "~/player/audio";
import * as console from "console";

const MONTH_ABBREVS = {
  Jan: "January",
  Feb: "February",
  Mar: "March",
  Apr: "April",
  May: "May",
  Jun: "June",
  Jul: "July",
  Aug: "August",
  Sep: "September",
  Oct: "October",
  Nov: "November",
  Dec: "December",
} as const;

function unabbreviateMonths(text: string): string {
  for (const [short, long] of Object.entries(MONTH_ABBREVS)) {
    text = text.replaceAll(short + ".", long);
  }

  return text;
}

export default class PiperTtsEngine implements TtsEngine {
  private audio: AudioHelper | null = null;
  private prefetchAudio: [string, TtsOptions, string] | null = null;
  private speaking = false;

  static readonly DEFAULT_URL = "http://localhost:5000";

  readonly name = "Piper TTS Engine";

  constructor(private readonly url: URL) {
  }

  async speak(utterance: string, options: TtsOptions, onEvent: TtsEngineEventHandler) {
    utterance = this.preprocess(utterance);

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

  private preprocess(utterance: string) {
    // Improve list numbering pronunciation.
    utterance = utterance.replace(/^(\d+)\. /gm, "$1: ");

    // Correct pronunciation of dollars.
    utterance = utterance.replace(/\$([\d,.]+\s+dollars?)/g, "$1"); // Remove dollar sign to prevent "dollar X dollar(s)".
    utterance = utterance.replace(/\$([\d,.]+)/g, "$1 $"); // Move dollar sign to end to prevent "dollar X".

    // Replace em and en dashes with commas.
    utterance = utterance.replace(/[—–]/g, ", ");

    // Add pauses around parentheses.
    utterance = utterance.replace(/\s+(\([^)]+\))\b/g, ", $1,");

    utterance = unabbreviateMonths(utterance);

    return utterance;
  }
}

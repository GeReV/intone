import { AudioHelper, TtsEngine, TtsEngineEventHandler, TtsOptions, TtsVoice } from "~/player/ttsEngines";
import assert from "~/utils/assert";
import { playAudio } from "~/player/audio";

type Mimic3Voice = {
  aliases: string[] | null;
  description: string;
  key: string;
  language: string;
  language_english: string;
  language_native: string;
  location: string;
  name: string;
  properties: Record<string, unknown>;
  sample_text: string;
  speakers: string[] | null;
  version: string | null;
};

export default class Mimic3TtsEngine implements TtsEngine {
  private audio: AudioHelper | null = null;
  private prefetchAudio: [string, TtsOptions, string] | null = null;
  private speaking = false;

  readonly name = "Mimic 3 Engine";

  async speak(utterance: string, options: TtsOptions, onEvent: TtsEngineEventHandler) {
    const url = (this.prefetchAudio && this.prefetchAudio[0] === utterance && this.prefetchAudio[1] === options) ?
      this.prefetchAudio[2] :
      await this.getAudioUrl(utterance, options.voice);

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
      // TODO
      en: "",
    };
  }

  async getVoices(): Promise<TtsVoice[]> {
    const response = await fetch("http://localhost:59125/api/voices");

    if (!response.ok) {
      throw new Error(await response.text());
    }

    const result = await response.json() as Mimic3Voice[];

    return result.flatMap(voice => {
      if (voice.speakers?.length) {
        return voice.speakers.map(speaker => ({
          key: `${voice.key}#${speaker}`,
          language: voice.language_english,
          name: `${voice.name} - ${speaker}`,
        }));
      }

      return {
        key: voice.key,
        language: voice.language_english,
        name: voice.name,
      };
    });
  }

  private async getAudioUrl(text: string, voice: string): Promise<string> {
    assert(text && voice);

    const res = await fetch(`http://localhost:59125/api/tts?voice=${voice}`, {
      method: "POST",
      body: text
    });
    if (!res.ok) {
      throw await res.text();
    }

    return URL.createObjectURL(await res.blob());
  }
}

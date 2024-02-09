import { AudioHelper, TtsEngine, TtsEngineEventHandler, TtsOptions, TtsVoice } from "~/player/ttsEngines";
import assert from "~/utils/assert";
import browser from "webextension-polyfill";
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

export class Mimic3TtsEngine implements TtsEngine {
  private audio: AudioHelper | null = null;
  private prefetchAudio: [string, TtsOptions, string] | null = null;
  private speaking = false;

  private port: MessagePort | undefined;

  async speak(utterance: string, options: TtsOptions, onEvent: TtsEngineEventHandler) {
    if (!this.port) {
      this.port = createPlayerFrame();
    }

    const url = (this.prefetchAudio && this.prefetchAudio[0] === utterance && this.prefetchAudio[1] === options) ?
      this.prefetchAudio[2] :
      await this.getAudioUrl(utterance, options.voice, options.pitch);

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
      const url = await this.getAudioUrl(utterance, options.voice, options.pitch);
      this.prefetchAudio = [utterance, options, url];
    } catch (err) {
      console.error(err);
    }
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

  async getAudioUrl(text: string, voice: string, pitch?: number): Promise<string> {
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

function createPlayerFrame() {
  const channel = new MessageChannel();

  const frame = document.createElement("iframe");
  frame.src = browser.runtime.getURL("dist/player/player.html");
  frame.style.position = "absolute";
  frame.style.height = "0";
  frame.style.borderWidth = "0";

  // TODO: Remove
  frame.style.height = "200px";
  frame.style.width = "200px";
  frame.style.top = "0";
  frame.style.zIndex = "999999";

  document.body.appendChild(frame);

  frame.addEventListener("load", () => {
    assert(frame.contentWindow);
    frame.contentWindow.postMessage("init", "*", [channel.port2]);
  });

  return channel.port1;
}
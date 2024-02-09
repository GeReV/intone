import { AudioHelper, TtsEngine, TtsEngineEventHandler, TtsOptions, TtsVoice } from "~/player/ttsEngines";
import assert from "~/utils/assert";
import browser from "webextension-polyfill";
import { playAudio } from "~/player/audio";

type CoquiVoice = {
  key: string;
  name: string;
  language: string;
  model_name: string;
};

export class CoquiTtsEngine implements TtsEngine {
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
    const response = await fetch("http://localhost:5002/api/voices");

    if (!response.ok) {
      throw new Error(await response.text());
    }

    return await response.json() as CoquiVoice[];
  }

  async getAudioUrl(text: string, voice: string, pitch?: number): Promise<string> {
    assert(text && voice);

    const url = new URL("http://localhost:5002/api/tts");
    url.searchParams.set("speaker_id", voice);
    url.searchParams.set("text", text);

    const res = await fetch(url, {
      method: "POST",
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
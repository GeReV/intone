import { DataTypeKey, GetDataType, GetReturnType } from "webext-bridge";
import browser from "webextension-polyfill";
import { TtsOptions } from "~/player/ttsEngines";
import { PortMessage } from "~/player/types";
import { nextId } from "~/utils";
import assert from "~/utils/assert";

export type SpeechPosition = {
  index: number;
  texts: string[];
  isRTL: boolean;
};

type SpeechEvent =
  { type: "start" | "end" } |
  {
    type: "error",
    error: {
      message: string,
    }
  };

const PLAYER_FRAME_ID = "__readout_player_frame";

async function sendMessageWithResponse<K extends DataTypeKey>(port: MessagePort, messageId: K, data: GetDataType<K, null>): Promise<GetReturnType<K>> {
  return new Promise<GetReturnType<K>>(resolve => {
    const id = nextId();

    const listener = (evt: MessageEvent<PortMessage<GetReturnType<K>>>) => {
      const response = evt.data;

      if (response.type === messageId && response.id === id) {
        port.removeEventListener("message", listener, false);

        resolve(response.data);
      }
    };
    port.addEventListener("message", listener, false);
    port.start();

    port.postMessage({
      type: messageId,
      data,
      id
    });
  });
}

export class Speech {
  private readonly pauseDuration: number;
  private readonly ready: Promise<unknown>;
  private state: "IDLE" | "PLAYING" | "PAUSED" | "LOADING" | "ERROR" = "IDLE";
  private startTime = 0;
  private index = 0;
  private delayedPlayTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly port: Promise<MessagePort>;

  constructor(private readonly texts: string[], private readonly options: Omit<TtsOptions, "voice">, public onEnd?: (err?: unknown) => void) {
    options.rate = (options.rate || 1); // * (isGoogleNative(options.voice) ? 0.9 : 1);

    this.pauseDuration = 650 / options.rate;

    for (let i = 0; i < texts.length; i++) {
      if (/[\w)]$/.test(texts[i] ?? "")) {
        texts[i] += ".";
      }
    }

    this.port = createPlayerFrame();

    this.ready = this.port;
  }

  async getState(): Promise<"PLAYING" | "PAUSED" | "LOADING"> {
    const isSpeaking = await sendMessageWithResponse(await this.port, "is-speaking", null);

    if (this.state === "PLAYING") {
      return isSpeaking ? "PLAYING" : "LOADING";
    }

    return "PAUSED";
  }

  getPosition(): SpeechPosition {
    return {
      index: this.index,
      texts: this.texts,
      isRTL: /^(ar|az|dv|he|iw|ku|fa|ur)\b/.test(this.options.lang),
    };
  }

  async play() {
    if (this.index >= this.texts.length) {
      this.state = "IDLE";
      if (this.onEnd) {
        this.onEnd();
      }
    } else if (this.state === "PAUSED") {
      this.state = "PLAYING";

      try {
        await sendMessageWithResponse(await this.port, "resume", null);
      } catch (err) {
        console.error("Couldn't resume", err);

        this.state = "IDLE";

        await this.play();
      }
    } else {
      this.state = "PLAYING";
      this.startTime = Date.now();

      await this.ready;

      await this.speak(this.texts[this.index] ?? "",
        async () => {
          this.state = "IDLE";

          // if (this.engine.setNextStartTime) {
          await sendMessageWithResponse(await this.port, "set-next-start-time", Date.now() + this.pauseDuration);
          // this.engine.setNextStartTime(Date.now() + this.pauseDuration);
          // }

          this.index++;

          try {
            await this.play();
          } catch (err) {
            if (this.onEnd) {
              this.onEnd(err);
            }
          }
        },
        (err) => {
          this.state = "IDLE";
          if (this.onEnd) {
            this.onEnd(err);
          }
        });

      const prefetchText = this.texts[this.index + 1];
      if (prefetchText /*&& this.engine.prefetch*/) {
        await sendMessageWithResponse(await this.port, "prefetch", { prefetchText, options: this.options });
      }
    }
  }

  delayedPlay() {
    clearTimeout(this.delayedPlayTimer);

    this.delayedPlayTimer = setTimeout(async () => {
      await this.stop();
      await this.play();
    }, 750);

    return Promise.resolve();
  }

  canPause() {
    // return !!this.engine.pause;
    return true;
  }

  async pause() {
    await this.ready;

    if (this.canPause()) {
      clearTimeout(this.delayedPlayTimer);

      await sendMessageWithResponse(await this.port, "pause", null);
      // this.engine.pause();

      this.state = "PAUSED";
    } else {
      await this.stop();
    }
  }

  async stop() {
    await this.ready;

    clearTimeout(this.delayedPlayTimer);

    await sendMessageWithResponse(await this.port, "stop", null);

    this.state = "IDLE";
  }

  async forward() {
    if (this.index + 1 < this.texts.length) {
      this.index++;
      if (this.state === "PLAYING") {
        return this.delayedPlay();
      } else {
        await this.stop();
      }
    } else {
      throw new Error("Can't forward, at end");
    }
  }

  async rewind() {
    if (this.state === "PLAYING" && Date.now() - this.startTime > 3 * 1000) {
      await this.stop();
      await this.play();
    } else if (this.index > 0) {
      this.index--;
      if (this.state === "PLAYING") {
        await this.stop();
        await this.play();
      } else {
        await this.stop();
      }
    } else {
      throw new Error("Can't rewind, at beginning");
    }
  }

  async seek(n: number) {
    this.index = n;

    await this.stop();
    await this.play();
  }

  async gotoEnd() {
    await this.ready;

    this.index = this.texts.length && this.texts.length - 1;
  }

  async speak(text: string, onEnd: () => void, onError: (err: unknown) => void) {
    // if (!this.engine) {
    //   reject(new Error("Missing TTS engine"));
    //   return;
    // }

    const port = await this.port;

    const id = nextId();

    const listener = (evt: MessageEvent<PortMessage<SpeechEvent>>) => {
      const response = evt.data;
      if (response.id === id) {
        console.log("received speak with id", id, evt.data);

        const inner = response.data;

        switch (inner.type) {
          case "start":
            if (this.state === "IDLE") {
              this.state = "PLAYING";
            }
            break;
          case "end":
            port.removeEventListener("message", listener, false);

            if (this.state === "IDLE") {
              this.state = "ERROR";

              throw new Error("TTS engine end event before start event");
            } else if (this.state === "PLAYING") {
              onEnd();
              this.state = "IDLE";
            }
            break;
          case "error":
            port.removeEventListener("message", listener, false);

            if (inner.error.message === "Aborted") {
              /* empty */
            } else if (this.state === "IDLE") {
              this.state = "ERROR";

              throw new Error(inner.error.message);
            } else if (this.state === "PLAYING") {
              onError(inner.error);
              this.state = "ERROR";
            }
            break;
        }
      }
    };
    port.addEventListener("message", listener, false);
    port.start();

    console.log("sent speak with id", id);
    port.postMessage({
      type: "speak",
      id,
      data: {
        text,
        options: this.options
      },
    });
  }
}

function createPlayerFrame(): Promise<MessagePort> {
  return new Promise<MessagePort>(resolve => {
    const channel = new MessageChannel();

    let frame: HTMLIFrameElement | null = document.querySelector(`#${PLAYER_FRAME_ID}`);

    if (frame) {
      assert(frame.contentWindow);
      frame.contentWindow.postMessage("init", "*", [channel.port2]);

      resolve(channel.port1);
      return;
    }

    frame = document.createElement("iframe");
    frame.id = PLAYER_FRAME_ID;
    frame.src = browser.runtime.getURL("dist/player/index.html");
    frame.style.position = "absolute";
    frame.style.height = "0";
    frame.style.borderWidth = "0";

    document.body.appendChild(frame);

    frame.addEventListener("load", function () {
      assert(this.contentWindow);
      this.contentWindow.postMessage("init", "*", [channel.port2]);

      channel.port1.start();

      resolve(channel.port1);
    });
  });
}

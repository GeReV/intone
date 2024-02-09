import assert from "~/utils/assert";
import { TtsOptions } from "~/player/ttsEngines";
import browser from "webextension-polyfill";
import { nextId } from "~/utils";

export type SpeechPosition = {
  index: number;
  texts: string[];
  isRTL: boolean;
};

async function sendMessageWithResponse<T>(port: MessagePort, message: unknown): Promise<T> {
  return new Promise(resolve => {
    const id = nextId();

    const listener = (evt: MessageEvent) => {
      const response = evt.data;

      if (response.type === message.type && response.id === id) {
        port.removeEventListener("message", listener, false);

        resolve(response.data);
      }
    };
    port.addEventListener("message", listener, false);
    port.start();

    port.postMessage({
      type: message.type,
      data: message.data,
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

  constructor(private readonly texts: string[], private readonly options: Exclude<TtsOptions, "voice">, public onEnd?: (err?: unknown) => void) {
    options.rate = (options.rate || 1); // * (isGoogleNative(options.voice) ? 0.9 : 1);

    this.pauseDuration = 650 / options.rate;

    for (let i = 0; i < texts.length; i++) {
      if (/[\w)]$/.test(texts[i] ?? "")) {
        texts[i] += ".";
      }
    }

    if (this.texts.length) {
      this.texts = this.getChunks(this.texts.join("\n\n"));
    }

    this.port = createPlayerFrame();

    this.ready = this.port;
  }

  getChunks(text: string) {
    const isEA = /^zh|ko|ja/.test(this.options.lang);
    const punctuator = isEA ? new EastAsianPunctuator() : new LatinPunctuator();

    return new CharBreaker(750, punctuator, 200).breakText(text);
  }

  async getState(): Promise<"PLAYING" | "PAUSED" | "LOADING"> {
    const isSpeaking = await sendMessageWithResponse(await this.port, { type: "is-speaking" });

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
        await sendMessageWithResponse(await this.port, { type: "resume" });
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
          await sendMessageWithResponse(await this.port, {
            type: "set-next-start-time",
            data: Date.now() + this.pauseDuration
          });
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
        await sendMessageWithResponse(await this.port, {
          type: "prefetch",
          data: { prefetchText, options: this.options }
        });
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

      await sendMessageWithResponse(await this.port, { type: "pause" });
      // this.engine.pause();

      this.state = "PAUSED";
    } else {
      await this.stop();
    }
  }

  async stop() {
    await this.ready;

    clearTimeout(this.delayedPlayTimer);

    await sendMessageWithResponse(await this.port, { type: "stop" });

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

    const listener = (evt: MessageEvent) => {
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

              throw inner.error;
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


//text breakers


// class WordBreaker {
//   constructor(private readonly wordLimit: number, private readonly punctuator: Punctuator) {
//   }
//
//   breakText(text: string): string[] {
//     return this.punctuator.getParagraphs(text).flatMap(this.breakParagraph.bind(this));
//   }
//
//   private breakParagraph(text: string): string[] {
//     return this.punctuator.getSentences(text).flatMap(this.breakSentence.bind(this));
//   }
//
//   breakSentence(sentence: string): string[] {
//     return this.merge(this.punctuator.getPhrases(sentence), this.breakPhrase.bind(this));
//   }
//
//   breakPhrase(phrase: string): string[] {
//     let words = this.punctuator.getWords(phrase);
//
//     const splitPoint = Math.min(Math.ceil(words.length / 2), this.wordLimit);
//     const result: string[] = [];
//
//     while (words.length) {
//       result.push(words.slice(0, splitPoint).join(""));
//       words = words.slice(splitPoint);
//     }
//
//     return result;
//   }
//
//   merge(parts: string[], breakPart: (s: string) => string[]) {
//     const result: string[] = [];
//     let group: { wordCount: number; parts: string[] } = { parts: [], wordCount: 0 };
//
//     const flush = () => {
//       if (group.parts.length) {
//         result.push(group.parts.join(""));
//         group = { parts: [], wordCount: 0 };
//       }
//     };
//
//     parts.forEach((part) => {
//       const wordCount = this.punctuator.getWords(part).length;
//
//       if (wordCount > this.wordLimit) {
//         flush();
//
//         const subParts = breakPart(part);
//
//         for (const subPart of subParts) {
//           result.push(subPart);
//         }
//       } else {
//         if (group.wordCount + wordCount > this.wordLimit) {
//           flush();
//         }
//         group.parts.push(part);
//         group.wordCount += wordCount;
//       }
//     });
//
//     flush();
//
//     return result;
//   }
// }
//
class CharBreaker {
  constructor(private charLimit: number, private punctuator: Punctuator, private paragraphCombineThreshold: number) {
  }

  breakText(text: string): string[] {
    return this.merge(this.punctuator.getParagraphs(text), this.breakParagraph.bind(this), this.paragraphCombineThreshold);
  }

  breakParagraph(text: string): string[] {
    return this.merge(this.punctuator.getSentences(text), this.breakSentence.bind(this));
  }

  breakSentence(sentence: string): string[] {
    return this.merge(this.punctuator.getPhrases(sentence), this.breakPhrase.bind(this));
  }

  breakPhrase(phrase: string): string[] {
    return this.merge(this.punctuator.getWords(phrase), this.breakWord.bind(this));
  }

  breakWord(word: string): string[] {
    const result: string[] = [];

    while (word) {
      result.push(word.slice(0, this.charLimit));
      word = word.slice(this.charLimit);
    }

    return result;
  }

  merge(parts: string[], breakPart: (s: string) => string[], combineThreshold?: number) {
    const result: string[] = [];
    let group: { charCount: number; parts: string[] } = { parts: [], charCount: 0 };

    const flush = () => {
      if (group.parts.length) {
        result.push(group.parts.join(""));
        group = { parts: [], charCount: 0 };
      }
    };

    parts.forEach((part) => {
      const charCount = part.length;

      if (charCount > this.charLimit) {
        flush();

        const subParts = breakPart(part);

        for (const subPart of subParts) {
          result.push(subPart);
        }
      } else {
        if (group.charCount + charCount > (combineThreshold ?? this.charLimit)) {
          flush();
        }

        group.parts.push(part);
        group.charCount += charCount;
      }
    });

    flush();

    return result;
  }
}

//punctuators

interface Punctuator {
  getParagraphs(text: string): string[];

  getSentences(text: string): string[];

  getPhrases(text: string): string[];

  getWords(text: string): string[];
}

class LatinPunctuator implements Punctuator {
  getParagraphs(text: string) {
    return this.recombine(text.split(/((?:\r?\n\s*){2,})/));
  }

  getSentences(text: string) {
    return this.recombine(text.split(/([.!?]+[\s\u200b]+)/), /\b(\w|[A-Z][a-z]|Assn|Ave|Capt|Col|Comdr|Corp|Cpl|Gen|Gov|Hon|Inc|Lieut|Ltd|Rev|Univ|Jan|Feb|Mar|Apr|Aug|Sept|Oct|Nov|Dec|dept|ed|est|vol|vs)\.\s+$/);
  }

  getPhrases(sentence: string) {
    return this.recombine(sentence.split(/([,;:]\s+|\s-+\s+|—\s*)/));
  }

  getWords(sentence: string) {
    const tokens = sentence.trim().split(/([~@#%^*_+=<>]|[\s\-—/]+|\.(?=\w{2,})|,(?=[0-9]))/);
    const result: string[] = [];
    for (let i = 0; i < tokens.length; i += 2) {
      const t = tokens[i];

      if (t) {
        result.push(t);
      }

      if (i + 1 < tokens.length) {
        const t2 = tokens[i + 1];

        if (t2 && /^[~@#%^*_+=<>]$/.test(t2)) {
          result.push(t2);
        } else if (result.length) {
          result[result.length - 1] += t2;
        }
      }
    }

    return result;
  }

  recombine(tokens: string[], nonPunc?: RegExp) {
    const result: string[] = [];

    for (let i = 0; i < tokens.length; i += 2) {
      const part = (i + 1 < tokens.length) ? (tokens[i] + (tokens[i + 1] ?? "")) : tokens[i];

      if (part) {
        if (nonPunc && result.length && nonPunc.test(result[result.length - 1] ?? "")) {
          result[result.length - 1] += part;
        } else {
          result.push(part);
        }
      }
    }

    return result;
  }
}

class EastAsianPunctuator implements Punctuator {
  getParagraphs(text: string): string[] {
    return this.recombine(text.split(/((?:\r?\n\s*){2,})/));
  }

  getSentences(text: string): string[] {
    return this.recombine(text.split(/([.!?]+[\s\u200b]+|[\u3002\uff01]+)/));
  }

  getPhrases(sentence: string): string[] {
    return this.recombine(sentence.split(/([,;:]\s+|[\u2025\u2026\u3000\u3001\uff0c\uff1b]+)/));
  }

  getWords(sentence: string): string[] {
    return sentence.replace(/\s+/g, "").split("");
  }

  recombine(tokens: string[]): string[] {
    const result: string[] = [];

    for (let i = 0; i < tokens.length; i += 2) {
      const t = tokens[i];

      if (i + 1 < tokens.length) {
        const t2 = tokens[i + 1];
        assert(t2);

        result.push(t + t2);
      } else if (t) {
        result.push(t);
      }
    }

    return result;
  }
}

function createPlayerFrame() {
  const channel = new MessageChannel();

  const frame = document.createElement("iframe");
  frame.src = browser.runtime.getURL("dist/player/index.html");
  frame.style.position = "absolute";
  frame.style.height = "0";
  frame.style.borderWidth = "0";

  // TODO: Remove
  frame.style.height = "200px";
  frame.style.width = "200px";
  frame.style.top = "0";
  frame.style.zIndex = "999999";

  document.body.appendChild(frame);

  return new Promise<MessagePort>(resolve => {
    frame.addEventListener("load", () => {
      assert(frame.contentWindow);
      frame.contentWindow.postMessage("init", "*", [channel.port2]);

      channel.port1.start();

      resolve(channel.port1);
    });
  });
}
import { DocumentInfo, Source } from "./sources";
import browser from "webextension-polyfill";
import { DEFAULTS, getSettings } from "~/logic/settings";
import { Speech } from "~/player/speech";
import { TtsVoice } from "~/player/ttsEngines";
import { LANG_MAP } from "~/utils";

function truncateRepeatedChars(text: string, max: number): string {
  let result = "";
  let startIndex = 0;
  let count = 1;

  for (let i = 1; i < text.length; i++) {
    if (text.charCodeAt(i) === text.charCodeAt(i - 1) && !/^\d$/.test(text.charAt(i))) {
      count++;
      if (count === max) {
        result += text.slice(startIndex, i + 1);
      }
    } else {
      if (count >= max) {
        startIndex = i;
      }
      count = 1;
    }
  }

  if (count < max) {
    result += text.slice(startIndex);
  }

  return result;
}

function preprocess(text: string) {
  text = truncateRepeatedChars(text, 3);
  return text.replace(/https?:\/\/\S+/g, "HTTP URL.");
}

// function serverDetectLanguage(text) {
//   return ajaxPost(config.serviceUrl + "/read-aloud/detect-language", { text: text }, "json")
//     .then(JSON.parse)
//     .then(function (res) {
//       var result = Array.isArray(res) ? res[0] : res;
//       if (result && result.language && result.language != "und") return result.language;
//       else return null;
//     })
//     .catch(function (err) {
//       console.error(err);
//       return null;
//     });
// }

async function browserDetectLanguage(text: string) {
  const result = await browser.i18n.detectLanguage(text);

  const list = result.languages.filter((item) => item.language !== "und");

  list.sort((a, b) => b.percentage - a.percentage);

  return list[0]?.language ?? null;
}

async function detectLanguageOf(text: string) {
  // if (text.length < 100) {
  //   //too little text, use cloud detection for improved accuracy
  //   return serverDetectLanguage(text)
  //     .then(function (result) {
  //       return result || browserDetectLanguage(text);
  //     })
  //     .then(function (lang) {
  //       //exclude commonly misdetected languages
  //       return ["cy", "eo"].includes(lang) ? null : lang;
  //     });
  // }
  //
  // return browserDetectLanguage(text)
  //   .then(function (result) {
  //     return result || serverDetectLanguage(text);
  //   });

  return await browserDetectLanguage(text);
}

// function parseLang(lang: string) {
//   const tokens = lang.toLowerCase().replace(/_/g, "-").split(/-/, 2);
//   return {
//     lang: tokens[0],
//     rest: tokens[1]
//   };
// }

function findVoiceByLang(voices: TtsVoice[], lang: string) {
  // const speechLang = parseLang(lang);
  // const match = {};
  // voices.forEach(function (voice) {
  //   if (voice.lang) {
  //     var voiceLang = parseLang(voice.lang);
  //     if (voiceLang.lang == speechLang.lang) {
  //       //language matches
  //       if (voiceLang.rest == speechLang.rest) {
  //         //dialect matches, prefer female
  //         if (voice.gender == "female") match.first = match.first || voice;
  //         else match.second = match.second || voice;
  //       } else if (!voiceLang.rest) {
  //         //voice specifies no dialect
  //         match.third = match.third || voice;
  //       } else {
  //         //dialect mismatch, prefer en-US (if english)
  //         if (voiceLang.lang == "en" && voiceLang.rest == "us") match.fourth = match.fourth || voice;
  //         else match.sixth = match.sixth || voice;
  //       }
  //     }
  //   } else {
  //     //voice specifies no language, assume can handle any lang
  //     match.fifth = match.fifth || voice;
  //   }
  // });
  // return match.first || match.second || match.third || match.fourth || match.fifth || match.sixth;

  return voices[0];
}

export class Doc {
  private info: DocumentInfo | undefined;
  private currentIndex = 0;
  private activeSpeech: Speech | null = null;

  private foundText = false;

  get ready() {
    return this.source.ready;
  }

  constructor(private readonly source: Source, private readonly onEnd?: (err?: unknown) => void) {
    void this.initialize();
  }

  private async initialize() {
    // const uri = await this.source.getUri();
    //
    // await browser.storage.local.set({
    //   lastUrl: uri
    // });
    //
    // this.info = await this.ready;
  }

  //method close
  async close() {
    try {
      await this.ready;
    } catch (err) {
      /* empty */
    }

    if (this.activeSpeech) {
      await this.activeSpeech.stop();
      this.activeSpeech = null;
    }

    await this.source.close();
  }

  //method play
  async play() {
    if (this.activeSpeech) {
      await this.activeSpeech.play();
      return;
    }

    await this.ready;

    this.currentIndex = await this.source.getCurrentIndex();

    await this.readCurrent();
  }

  async readCurrent(rewinded = false) {
    const texts = await this.source.getTexts(this.currentIndex);

    if (texts) {
      if (texts.length) {
        this.foundText = true;

        await this.read(texts, rewinded);
      } else {
        this.currentIndex++;

        await this.readCurrent();
      }
    } else {
      if (!this.foundText) {
        throw new Error(JSON.stringify({ code: "error_no_text" }));
      }

      if (this.onEnd) {
        this.onEnd();
      }
    }
  }

  async read(texts: string[], rewinded: boolean) {
    texts = texts.map(preprocess);

    if (this.info && !this.info.detectedLang) {
      const lang = await this.detectLanguage(texts);

      this.info.detectedLang = lang ?? "";
    }

    if (this.activeSpeech) {
      return;
    }

    this.activeSpeech = await this.getSpeech(texts);
    this.activeSpeech.onEnd = async (err: unknown) => {
      if (err) {
        if (this.onEnd) {
          this.onEnd(err);
        }
      } else {
        this.activeSpeech = null;
        this.currentIndex++;

        try {
          await this.readCurrent();
        } catch (e) {
          if (this.onEnd) {
            this.onEnd(err);
          }
        }
      }
    };
    if (rewinded) {
      await this.activeSpeech.gotoEnd();
    }

    return this.activeSpeech.play();
  }

  async detectLanguage(texts: string[]) {
    const minChars = 240;
    const maxPages = 10;
    const output = combineTexts("", texts);

    const accumulateMore = async (output: string, index: number): Promise<string> => {
      const texts = await this.source.getTexts(index, true);

      if (!texts) {
        return output;
      }

      output = combineTexts(output, texts);

      return output.length < minChars && index - this.currentIndex < maxPages ? accumulateMore(output, index + 1) : output;
    };

    if (output.length < minChars) {
      const result = await accumulateMore(output, this.currentIndex + 1);

      const detectedLang = await detectLanguageOf(result);

      //for sources that couldn't flip page silently, flip back to the current page
      await this.source.getTexts(this.currentIndex, true);

      return detectedLang;
    } else {
      return detectLanguageOf(output);
    }

    function combineTexts(output: string, texts: string[]) {
      for (let i = 0; i < texts.length && output.length < minChars; i++) {
        output += (texts[i] + " ");
      }

      return output;
    }
  }

  async getSpeech(texts: string[]) {
    const settings = await getSettings();

    let lang = (!this.info?.detectedLang || this.info.lang && this.info.lang.startsWith(this.info.detectedLang)) ? this.info?.lang : this.info.detectedLang;
    if (lang) {
      lang = LANG_MAP[lang] ?? lang;
    }
    lang ??= "en-US";

    console.log("Declared", this.info?.lang, "- Detected", this.info?.detectedLang, "- Chosen", lang);

    const options = {
      rate: settings.rate ?? DEFAULTS.rate,
      pitch: settings.pitch ?? DEFAULTS.pitch,
      volume: settings.volume ?? DEFAULTS.volume,
      lang,
    };

    return new Speech(texts, options);
  }

  //method stop
  async stop() {
    await this.ready;

    if (this.activeSpeech) {
      await this.activeSpeech.stop();
      this.activeSpeech = null;
    }
  }

  //method pause
  async pause() {
    await this.ready;

    if (this.activeSpeech) {
      await this.activeSpeech.pause();
    }
  }

  //method getState
  async getState(): Promise<"PLAYING" | "PAUSED" | "LOADING" | "STOPPED"> {
    if (this.activeSpeech) {
      const state = await this.activeSpeech.getState();

      console.log("state", state);

      return state;
    }

    return this.source.isWaiting() ? "LOADING" : "STOPPED";
  }

  //method getActiveSpeech
  getActiveSpeech() {
    return this.activeSpeech;
  }

  //method forward
  async forward() {
    if (this.activeSpeech) {
      try {
        return this.activeSpeech.forward();
      } catch (e) {
        await this.forwardPage();
      }
    } else return Promise.reject(new Error("Can't forward, not active"));
  }

  async forwardPage() {
    await this.stop();

    this.currentIndex++;

    await this.readCurrent();
  }

  //method rewind
  async rewind() {
    if (this.activeSpeech) {
      try {
        return this.activeSpeech.rewind();
      } catch (e) {
        await this.rewindPage();
      }
    } else {
      throw new Error("Can't rewind, not active");
    }
  }

  async rewindPage() {
    await this.stop();

    this.currentIndex--;

    await this.readCurrent(true);
  }

  seek(n: number) {
    if (this.activeSpeech) {
      return this.activeSpeech.seek(n);
    }

    throw new Error("Can't seek, not active");
  }
}

import { getSettings } from "~/logic/settings";
import assert from "~/utils/assert";
import { TtsEngine } from "~/player/ttsEngines";
import { CoquiTtsEngine } from "~/player/coquiTtsEngine";
import { Messages } from "~/player/types";

window.addEventListener("message", initPort);

let port: MessagePort | undefined;

// Setup the transferred port
function initPort(evt: MessageEvent) {
  port = evt.ports[0];

  console.log("register");

  assert(port);
  port.onmessage = onMessage;
}

const engine = new CoquiTtsEngine();

async function getSpeechVoice(engine: TtsEngine, voiceName: string | undefined, lang: string) {
  const [voices, settings] = await Promise.all([engine.getVoices(), getSettings(["preferredVoices"])]);

  return voices.find(v => v.language === "en");

  // const preferredVoiceByLang: Record<string, string> = settings.preferredVoices ?? {};
  // let voice;
  // //if a specific voice is indicated
  // if (voiceName) {
  //   voice = voices.find(v => v.key === voiceName);
  // }
  //
  // //if no specific voice indicated, but a preferred voice was configured for the language
  // if (!voice && lang) {
  //   const voiceName = preferredVoiceByLang[lang.split("-")[0] ?? ""];
  //   if (voiceName) {
  //     voice = voices.find(v => v.key === voiceName);
  //   }
  // }
  // //otherwise, auto-select
  // if (!voice && lang) {
  //   voice = findVoiceByLang(voices, lang);
  // }
  //
  // return voice;
}

// Handle messages received on port2

async function onMessage(evt: MessageEvent<Messages>) {
  const message = evt.data;

  switch (message.type) {
    case "is-speaking":
      port?.postMessage({ ...message, data: engine.isSpeaking() });
      return;
    case "speak": {
      const voice = await getSpeechVoice(engine, undefined, "en");

      assert(voice);

      const options = {
        ...message.data.options,
        voice: voice.key,
      };

      const messageId = message.id;

      await engine.speak(message.data.text, options, (evt) => {
        port?.postMessage({
          type: "speak",
          id: messageId,
          data: evt,
        });
      });
      return;
    }
    case "prefetch": {
      const voice = await getSpeechVoice(engine, undefined, "en");

      assert(voice);

      const options = {
        ...message.data.options,
        voice: voice.key,
      };

      await engine.prefetch(message.data.prefetchText, options);
      break;
    }
    case "resume":
      await engine.resume();
      break;
    case "pause":
      engine.pause();
      break;
    case "stop":
      engine.stop();
      break;
  }

  // Ack with the same message.
  port?.postMessage({
    type: message.type,
    id: message.id,
  });
}

document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
  // setI18nText();

  // const hideThisTabLink = $<HTMLElement>("#hidethistab-link");
  //
  // hideThisTabLink.hidden = /*canUseEmbeddedPlayer() &&*/ (await getSettings()).useEmbeddedPlayer ?? false;
  //
  // const dialogElements = $$<HTMLElement>("#dialog-backdrop, #hidethistab-dialog");
  //
  // hideThisTabLink.addEventListener("click", () => {
  //   dialogElements.forEach(el => {
  //     el.hidden = false;
  //   });
  // }, false);

  // $$<HTMLElement>("#hidethistab-dialog .btn, #hidethistab-dialog .close")
  //   .forEach(el => {
  //     el.addEventListener("click", async (evt) => {
  //       dialogElements.forEach(el2 => {
  //         el2.hidden = true;
  //       });
  //
  //       if (evt.target instanceof Element && evt.target.matches(".btn-ok")) {
  //         try {
  //           await updateSettings({ useEmbeddedPlayer: true });
  //
  //           window.close();
  //         } catch (err) {
  //           console.error(err);
  //         }
  //       }
  //     }, false);
  //   });
}


// async function shouldPlaySilence(providerId) {
//   const should = await getPlaybackState().then(x => x.state == "PLAYING");
//   const now = Date.now();
//   if (providerId == this.providerId) {
//     this.nextExpectedCheckIn = now + (now - this.lastCheckIn);
//     this.lastCheckIn = now;
//     return should;
//   } else {
//     if (now < this.nextExpectedCheckIn) {
//       return false;
//     } else {
//       this.providerId = providerId;
//       this.lastCheckIn = now;
//       return should;
//     }
//   }
// }
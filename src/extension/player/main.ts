import { getSettings } from "~/utils/settings";
import assert from "~/utils/assert";
import { TtsEngine } from "~/player/ttsEngines";
import Engine from "~/player/engines/piperTtsEngine";
import { Messages } from "~/player/types";

window.addEventListener("message", initPort);

let port: MessagePort | undefined;

// Setup the transferred port
function initPort(evt: MessageEvent) {
  port = evt.ports[0];

  assert(port);

  port.onmessage = onMessage;
}

const engineInit = getSettings(["serverUrl"])
  .then(settings => new Engine(new URL(settings.serverUrl ?? Engine.DEFAULT_URL)));

async function getSpeechVoice(engine: TtsEngine, lang = "en") {
  const [voices, settings] = await Promise.all([
    engine.getVoices(),
    getSettings(["preferredVoices"])
  ]);

  const preferredVoice = settings.preferredVoices?.[lang] ?? engine.preferredVoices()[lang];

  return voices.find(v => v.key === preferredVoice) ?? voices.find(v => v.language === lang) ?? voices[0];
}

// Handle messages received on port2

async function onMessage(evt: MessageEvent<Messages>) {
  const message = evt.data;

  const engine = await engineInit;

  switch (message.type) {
    case "is-speaking":
      port?.postMessage({ ...message, data: engine.isSpeaking() });
      return;
    case "speak": {
      const voice = await getSpeechVoice(engine, "en");

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
      const voice = await getSpeechVoice(engine, "en");

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
import { $ } from "~/utils/dom";
import { getSettings, updateSettings } from "~/logic/settings";
import { CoquiTtsEngine } from "~/player/coquiTtsEngine";
import { TtsEngine } from "~/player/ttsEngines";

void (async () => {
  console.log("hi");
  let engine: CoquiTtsEngine;
  const form = $<HTMLFormElement>("#app form");

  const fieldsets = form.querySelectorAll("fieldset");

  fieldsets.forEach(f => {
    f.disabled = true;
  });

  const serverUrl = $<HTMLInputElement>("#server-url", form);
  const serverTestBtn = $<HTMLButtonElement>("#server-test", form);

  const preferredVoiceSelect = $<HTMLSelectElement>("#preferred-voice", form);

  const saveBtn = $<HTMLInputElement>("#save", form);

  serverTestBtn.addEventListener("click", async (evt) => {
    evt.preventDefault();

    try {
      engine = new CoquiTtsEngine(new URL(serverUrl.value));

      await engine.getVoices();

      // Show success
    } catch (err) {
      // Show failure
    }
  }, false);

  saveBtn.addEventListener("click", async (evt) => {
    evt.preventDefault();

    await updateSettings({
      serverUrl: serverUrl.value,
      preferredVoices: {
        en: preferredVoiceSelect.value
      }
    });
  }, false);

  const settings = await getSettings(["serverUrl", "preferredVoices"]);

  const baseUrl = settings.serverUrl ?? CoquiTtsEngine.DEFAULT_URL;

  engine = new CoquiTtsEngine(new URL(baseUrl));

  const preferredVoice = settings.preferredVoices?.en ?? engine.preferredVoices().en;

  serverUrl.value = baseUrl;

  await populateVoices(preferredVoiceSelect, engine, preferredVoice);

  fieldsets.forEach(f => {
    f.disabled = false;
  });
})();

async function populateVoices(select: HTMLSelectElement, engine: TtsEngine, preferredVoice: string | undefined) {
  try {
    const voices = await engine.getVoices();

    while (select.options[0]) {
      select.options.remove(0);
    }

    for (const voice of voices) {
      select.options.add(new Option(
        voice.key,
        voice.name,
        voice.key === preferredVoice,
        voice.key === preferredVoice
      ));
    }
  } catch (err) {
    console.error(err);
  }
}
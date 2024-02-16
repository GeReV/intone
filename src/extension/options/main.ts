import { $, $$ } from "~/utils/dom";
import { DEFAULT_SETTINGS, getSettings, updateSettings } from "~/utils/settings";
import { TtsEngine } from "~/player/ttsEngines";
import Engine from "~/player/engines/piperTtsEngine";
import assert from "~/utils/assert";

void (async () => {
  let engine: TtsEngine;
  const form = $<HTMLFormElement>("#app form");

  const fieldsets = form.querySelectorAll("fieldset");

  const status = $<HTMLElement>("#status", form);

  fieldsets.forEach(f => {
    f.disabled = true;
  });

  const volumeSlider = $<HTMLInputElement>("#volume", form);
  const volumeValue = $("#volume-value", form);

  const engineName = $<HTMLLegendElement>("#engine-name", form);
  const serverUrl = $<HTMLInputElement>("#server-url", form);
  const serverTestBtn = $<HTMLButtonElement>("#server-test", form);

  const preferredVoiceSelect = $<HTMLSelectElement>("#preferred-voice", form);

  const rateSlider = $<HTMLInputElement>("#rate", form);
  const rateValue = $("#rate-value", form);

  const saveBtn = $<HTMLInputElement>("#save", form);

  serverTestBtn.addEventListener("click", async (evt) => {
    evt.preventDefault();

    assert(evt.target instanceof HTMLButtonElement);

    const target = evt.target;
    target.disabled = true;

    try {
      engine = new Engine(new URL(serverUrl.value));

      await engine.getVoices();

      showStatus("Server responded successfully", "text-success");

      target.disabled = false;
    } catch (err) {
      showStatus(err);
    }
  }, false);

  saveBtn.addEventListener("click", async (evt) => {
    evt.preventDefault();
    try {
      await save();

      showStatus("Changes saved", "text-success");
    } catch (err) {
      showStatus(err);
    }
  }, false);


  const formatRate = (rate: number) => `\u00D7${rate.toFixed(1)}`;

  volumeSlider.addEventListener("input", () => {
    volumeValue.textContent = volumeSlider.value;
  }, false);

  rateSlider.addEventListener("input", () => {
    rateValue.textContent = formatRate(rateSlider.valueAsNumber);
  }, false);

  form.addEventListener("input", () => {
    checkFormDirty(form);
  }, false);


  try {
    const settings = await getSettings(["serverUrl", "preferredVoices", "rate"]);

    const baseUrl = settings.serverUrl ?? Engine.DEFAULT_URL;

    engine = new Engine(new URL(baseUrl));

    engineName.textContent = engine.name;

    const preferredVoice = settings.preferredVoices?.en ?? engine.preferredVoices().en;

    serverUrl.defaultValue = baseUrl;

    volumeSlider.defaultValue = ((settings.volume ?? DEFAULT_SETTINGS.volume) * 100).toString();
    volumeValue.textContent = volumeSlider.value;

    rateSlider.defaultValue = (settings.rate ?? DEFAULT_SETTINGS.rate).toString();
    rateValue.textContent = formatRate(rateSlider.valueAsNumber);

    await populateVoices(preferredVoiceSelect, engine, preferredVoice);
  } catch (err) {
    showStatus(err);
  }

  fieldsets.forEach(f => {
    f.disabled = false;
  });

  async function save() {
    await updateSettings({
      serverUrl: serverUrl.value,
      preferredVoices: {
        en: preferredVoiceSelect.value
      },
      volume: volumeSlider.valueAsNumber / 100,
      rate: rateSlider.valueAsNumber,
    });

    form.classList.remove("form-dirty");
  }

  function showStatus(message: unknown, className = "text-error", autoHide = true) {
    let text;
    if (message instanceof Error) {
      text = message.message;
    } else if (typeof message === "string") {
      text = message;
    } else {
      text = JSON.stringify(message);
    }

    status.textContent = text;
    status.className = "";
    status.classList.add(className);
    status.hidden = false;

    if (autoHide) {
      setTimeout(hideStatus, 2000);
    }
  }

  function hideStatus() {
    status.hidden = true;
  }
})();

async function populateVoices(select: HTMLSelectElement, engine: TtsEngine, preferredVoice: string | undefined) {
  const voices = await engine.getVoices();

  while (select.options[0]) {
    select.options.remove(0);
  }

  for (const voice of voices) {
    select.options.add(new Option(
      voice.name,
      voice.key,
      voice.key === preferredVoice
    ));
  }

  // Select a default if we have none, so the form dirtiness check works.
  const hasDefault = Array.from(select.options).some(opt => opt.defaultSelected);
  if (!hasDefault) {
    const option = select.options.item(0);
    if (option) {
      option.defaultSelected = true;
    }
  }
}

function checkFormDirty(form: HTMLFormElement) {
  const inputs = $$<HTMLInputElement>("input", form);

  let dirty = false;

  for (let i = 0; i < inputs.length; i++) {
    const input = inputs.item(i);

    if (input.defaultValue !== input.value || input.defaultChecked !== input.checked) {
      dirty = true;
      break;
    }
  }

  const selects = $$<HTMLSelectElement>("select", form);

  for (let i = 0; i < selects.length; i++) {
    const select = selects.item(i);

    for (let j = 0; j < select.options.length; j++) {
      const option = select.options.item(j);

      if (option?.defaultSelected !== option?.selected) {
        dirty = true;
        break;
      }
    }
  }

  form.classList.toggle("form-dirty", dirty);
}

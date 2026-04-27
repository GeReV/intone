// src/options/main.ts
import { DEFAULT_SETTINGS, getSettings, saveSettings } from '~/extension/content/settings'

const form = document.getElementById('form') as HTMLFormElement
const serverUrlInput = document.getElementById('serverUrl') as HTMLInputElement
const extractorSelect = document.getElementById('extractor') as HTMLSelectElement
const rateInput = document.getElementById('rate') as HTMLInputElement
const rateVal = document.getElementById('rateVal') as HTMLSpanElement
const volumeInput = document.getElementById('volume') as HTMLInputElement
const volumeVal = document.getElementById('volumeVal') as HTMLSpanElement
const savedMsg = document.getElementById('saved') as HTMLParagraphElement

async function load(): Promise<void> {
  const s = await getSettings()
  serverUrlInput.value = s.serverUrl
  extractorSelect.value = s.extractor
  rateInput.value = String(s.rate)
  rateVal.textContent = s.rate.toFixed(1)
  volumeInput.value = String(s.volume)
  volumeVal.textContent = String(Math.round(s.volume * 100))
}

rateInput.addEventListener('input', () => {
  rateVal.textContent = Number(rateInput.value).toFixed(1)
})

volumeInput.addEventListener('input', () => {
  volumeVal.textContent = String(Math.round(Number(volumeInput.value) * 100))
})

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  await saveSettings({
    serverUrl: serverUrlInput.value || DEFAULT_SETTINGS.serverUrl,
    extractor: extractorSelect.value as 'readability',
    rate: Number(rateInput.value),
    volume: Number(volumeInput.value),
  })
  savedMsg.style.visibility = 'visible'
  setTimeout(() => { savedMsg.style.visibility = 'hidden' }, 2000)
})

void load()

import { DEFAULT_SETTINGS, getSettings, saveSettings } from '~/extension/content/settings'

interface EngineState { engine: string; voices: string[] }

const form = document.getElementById('form') as HTMLFormElement
const serverUrlInput = document.getElementById('serverUrl') as HTMLInputElement
const engineSelect = document.getElementById('engine') as HTMLSelectElement
const voiceSelect = document.getElementById('voiceName') as HTMLSelectElement
const extractorSelect = document.getElementById('extractor') as HTMLSelectElement
const rateInput = document.getElementById('rate') as HTMLInputElement
const rateVal = document.getElementById('rateVal') as HTMLSpanElement
const volumeInput = document.getElementById('volume') as HTMLInputElement
const volumeVal = document.getElementById('volumeVal') as HTMLSpanElement
const showPreviewInput = document.getElementById('showPreview') as HTMLInputElement
const showHighlightingInput = document.getElementById('showHighlighting') as HTMLInputElement
const savedMsg = document.getElementById('saved') as HTMLParagraphElement
const engineErrorMsg = document.getElementById('engineError') as HTMLParagraphElement
const engineStatus = document.getElementById('engineStatus') as HTMLElement

let prevEngine = ''

async function fetchEngineState(serverUrl: string): Promise<EngineState | null> {
  try {
    const res = await fetch(new URL('/engine', serverUrl).toString())
    if (!res.ok) {return null}
    return await res.json() as EngineState
  } catch {
    return null
  }
}

async function fetchEngines(serverUrl: string): Promise<string[]> {
  try {
    const res = await fetch(new URL('/engines', serverUrl).toString())
    if (!res.ok) {return []}
    return await res.json() as string[]
  } catch {
    return []
  }
}

function populateEngines(engines: string[], selected: string): void {
  engineSelect.innerHTML = ''
  if (engines.length === 0) {
    const opt = document.createElement('option')
    opt.value = ''
    opt.textContent = '— unavailable —'
    engineSelect.appendChild(opt)
    engineSelect.disabled = true
    prevEngine = ''
    return
  }
  engineSelect.disabled = false
  for (const e of engines) {
    const opt = document.createElement('option')
    opt.value = e
    opt.textContent = e
    opt.selected = e === selected
    engineSelect.appendChild(opt)
  }
  prevEngine = engineSelect.value
}

function populateVoices(voices: string[], selected: string): void {
  voiceSelect.innerHTML = ''
  if (voices.length === 0) {
    const opt = document.createElement('option')
    opt.value = ''
    opt.textContent = '— no voices —'
    voiceSelect.appendChild(opt)
    voiceSelect.disabled = true
    return
  }
  voiceSelect.disabled = false
  for (const v of voices) {
    const opt = document.createElement('option')
    opt.value = v
    opt.textContent = v
    opt.selected = v === selected
    voiceSelect.appendChild(opt)
  }
}

async function load(): Promise<void> {
  const s = await getSettings()
  serverUrlInput.value = s.serverUrl
  extractorSelect.value = s.extractor
  rateInput.value = String(s.rate)
  rateVal.textContent = s.rate.toFixed(1)
  volumeInput.value = String(s.volume)
  volumeVal.textContent = String(Math.round(s.volume * 100))
  showPreviewInput.checked = s.showPreview
  showHighlightingInput.checked = s.showHighlighting

  const [engines, state] = await Promise.all([
    fetchEngines(s.serverUrl),
    fetchEngineState(s.serverUrl),
  ])
  populateEngines(engines, state?.engine ?? '')
  populateVoices(state?.voices ?? [s.voiceName], s.voiceName)
}

engineSelect.addEventListener('change', async () => {
  const selected = engineSelect.value
  const revertTo = prevEngine
  engineErrorMsg.style.display = 'none'
  engineStatus.textContent = 'Switching engine…'
  engineStatus.style.display = 'block'
  engineSelect.disabled = true
  try {
    const url = new URL('/engine', serverUrlInput.value)
    url.searchParams.set('name', selected)
    const res = await fetch(url.toString(), { method: 'POST' })
    if (!res.ok) {
      const msg = (await res.text()).trim()
      throw new Error(msg || `Server error ${res.status}`)
    }
    const state = await res.json() as EngineState
    const currentVoice = voiceSelect.value
    populateVoices(state.voices, currentVoice)
    if (!state.voices.includes(currentVoice) && state.voices.length > 0) {
      await saveSettings({ voiceName: state.voices[0] })
    }
    prevEngine = selected
  } catch (err) {
    engineSelect.value = revertTo
    engineErrorMsg.textContent = err instanceof Error ? err.message : 'Failed to switch engine.'
    engineErrorMsg.style.display = 'block'
  } finally {
    engineStatus.style.display = 'none'
    engineSelect.disabled = false
  }
})

serverUrlInput.addEventListener('change', async () => {
  engineErrorMsg.style.display = 'none'
  const [engines, state] = await Promise.all([
    fetchEngines(serverUrlInput.value),
    fetchEngineState(serverUrlInput.value),
  ])
  populateEngines(engines, state?.engine ?? '')
  populateVoices(state?.voices ?? [voiceSelect.value], voiceSelect.value)
})

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
    voiceName: voiceSelect.value || DEFAULT_SETTINGS.voiceName,
    extractor: extractorSelect.value as 'readability',
    rate: Number(rateInput.value),
    volume: Number(volumeInput.value),
    showPreview: showPreviewInput.checked,
    showHighlighting: showHighlightingInput.checked,
  })
  savedMsg.style.visibility = 'visible'
  setTimeout(() => { savedMsg.style.visibility = 'hidden' }, 2000)
})

void load()

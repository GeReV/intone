// src/content/index.ts
import browser from 'webextension-polyfill'
import { HOOKS } from './extractor/hooks'
import { ReadabilityExtractor } from './extractor/readability'
import { chunkIntoGroups } from './chunker'
import { Queue } from './queue'
import { Player } from './player'
import { FloatingUI } from './ui'
import { getSettings, saveSettings } from './settings'
import type { Settings } from './settings'

type Message = { type: 'play' | 'stop' | 'forward' | 'rewind' | 'play-selection'; text?: string }

interface EngineState { engine: string; voices: string[] }

let player: Player | null = null
let ui: FloatingUI | null = null

async function fetchEngines(serverUrl: string): Promise<string[]> {
  try {
    const res = await fetch(new URL('/engines', serverUrl).toString())
    if (!res.ok) return []
    return await res.json() as string[]
  } catch {
    return []
  }
}

async function fetchEngineState(serverUrl: string): Promise<EngineState | null> {
  try {
    const res = await fetch(new URL('/engine', serverUrl).toString())
    if (!res.ok) return null
    return await res.json() as EngineState
  } catch {
    return null
  }
}

async function start(textOverride?: string): Promise<void> {
  let settings: Settings = await getSettings()

  let paragraphs: string[]
  let title: string

  if (textOverride) {
    paragraphs = textOverride.split(/\n{2,}/).map(s => s.trim()).filter(Boolean)
    title = ''
  }
  else {
    const extractor = new ReadabilityExtractor()
    let result = extractor.extract(document)

    const hook = HOOKS.find(h => h.matches(location.href))
    if (hook) result = hook.transform(result, document)

    paragraphs = result.paragraphs
    title = result.title
  }

  const groups = chunkIntoGroups(paragraphs)
  const flatChunks = groups.flatMap(g => g.sentences.map(s => s.text))

  if (flatChunks.length === 0) {
    console.warn('[Read Out] No readable content found on this page.')
    return
  }

  const queue = new Queue()
  queue.load(flatChunks)

  player = new Player(queue, settings)
  ui = new FloatingUI()
  ui.loadChunks(groups, settings)

  player.onStateChange = (state) => {
    ui?.update(state)
    if (state.state === 'stopped' || state.state === 'error') {
      teardown()
    }
  }

  ui.onPlay = () => { void player?.play() }
  ui.onPause = () => { player?.pause() }
  ui.onStop = () => { player?.stop() }
  ui.onForward = () => { void player?.forward() }
  ui.onRewind = () => { void player?.rewind() }
  ui.onSeekTo = (index) => { void player?.seekTo(index) }
  ui.onSettingsChange = async (partial) => {
    await saveSettings(partial)
    settings = { ...settings, ...partial }
    if (partial.rate !== undefined) player?.updateRate(partial.rate)
    if (partial.volume !== undefined) player?.updateVolume(partial.volume)
  }

  ui.onPanelOpen = async () => {
    const [engines, state] = await Promise.all([
      fetchEngines(settings.serverUrl),
      fetchEngineState(settings.serverUrl),
    ])
    ui?.setEngines(engines, state?.engine ?? '')
    ui?.setVoices(state?.voices ?? [settings.voiceName], settings.voiceName)
  }

  ui.onSwitchEngine = async (name, revert) => {
    try {
      const url = new URL('/engine', settings.serverUrl)
      url.searchParams.set('name', name)
      const res = await fetch(url.toString(), { method: 'POST' })
      if (!res.ok) { revert(); return }
      const state = await res.json() as EngineState
      ui?.setVoices(state.voices, settings.voiceName)
      const firstVoice = state.voices[0]
      if (!state.voices.includes(settings.voiceName) && firstVoice !== undefined) {
        await saveSettings({ voiceName: firstVoice })
        settings = { ...settings, voiceName: firstVoice }
        ui?.setVoices(state.voices, firstVoice)
      }
    } catch {
      revert()
    }
  }

  ui.onVoiceChange = async (voiceName) => {
    await saveSettings({ voiceName })
    settings = { ...settings, voiceName }
  }

  console.info(`[Read Out] Starting — "${title}", ${flatChunks.length} chunks`)
  void player.play()
}

function teardown(): void {
  ui?.remove()
  ui = null
  player = null
}

browser.runtime.onMessage.addListener((raw: unknown): undefined => {
  const message = raw as Message
  switch (message.type) {
    case 'play':
      if (!player) void start()
      else if (player.isPlaying) player.pause()
      else void player.play()
      break
    case 'play-selection':
      if (message.text) void start(message.text)
      break
    case 'stop':
      player?.stop()
      break
    case 'forward':
      void player?.forward()
      break
    case 'rewind':
      void player?.rewind()
      break
  }
  return undefined
})

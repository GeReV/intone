# Engine Selection & Options Page Design

**Date:** 2026-04-29
**Scope:** Add `GET /engines` to the server; add engine selector + voice selector to the extension's options page and floating UI settings panel; fix options page bugs.

---

## Context

The server now supports `GET /engine` (current engine + voices) and `POST /engine?name=<x>` (hot-swap). The extension has no engine concept — it only calls `GET /voices` and `GET /synthesize`. The options page has two bugs: `showPreview` has no form control, and the rate slider range mismatches the floating UI.

---

## Server — `GET /engines`

**New endpoint:** `GET /engines` → `["kokoro", "kokoro1"]`

A module-level constant `KNOWN_ENGINES: list[str] = ["kokoro", "kokoro1"]` is added to `server.py`. The `_build_engine` error message and the new endpoint both derive from it. The endpoint is stateless, read-only, no lock required.

`_build_engine` is updated to validate against `KNOWN_ENGINES` rather than a hardcoded inline string, keeping the list in one place.

---

## Extension — Settings

No new field added to `Settings`. Engine is not persisted locally — the server is the source of truth. The existing `voiceName` field continues to represent the user's preferred voice within whichever engine is currently active.

---

## Extension — Options Page

### New controls
- **Engine selector** (`<select id="engine">`): populated from `GET /engines`. Pre-selected from `GET /engine` response on load.
- **Show preview checkbox** (`<input type="checkbox" id="showPreview">`): saves `showPreview` setting. Currently missing from the form.

### Startup sequence
On `load()`, call `GET /engines` and `GET /engine` in parallel:
- Engines list → populate engine `<select>`; set selected value from `GET /engine` response
- Voices list (from `GET /engine`) → populate voice `<select>`; pre-select saved `voiceName`
- If saved `voiceName` is not in the returned voice list, select the first available voice

### Engine change behaviour
When engine `<select>` changes:
1. Call `POST /engine?name=<selected>`
2. On success: repopulate voice `<select>` from response voices; if saved `voiceName` absent, select and save first voice
3. On failure: revert selector to previous value; show inline error `"Failed to switch engine"`

### Server URL change behaviour
`serverUrlInput change` handler re-fetches `GET /engines` and `GET /engine` from the new URL in parallel, repopulating both dropdowns.

### Rate slider bug fix
Rate slider unified to **min 0.5, max 3, step 0.1** (the floating UI's 1–3 range was wrong; the server clamps at 0.5 minimum).

### Removal of `GET /voices` call
The standalone `fetchVoices` function that calls `GET /voices` is replaced by `fetchEngineState` that calls `GET /engine` and returns `{ engine, voices }`. `GET /voices` is no longer called from the options page.

---

## Extension — Floating UI Settings Panel

### New controls added to `FloatingUI`
- **Engine selector** (`<select>`): below the server URL input
- **Voice selector** (`<select>`): below the engine selector

### Startup / panel-open sequence
On first open of the settings panel (`toggleSettings`), fetch `GET /engines` and `GET /engine` in parallel:
- Populate engine selector from engines list; set value from `GET /engine` response
- Populate voice selector from `GET /engine` voices; set value from saved `settings.voiceName`
- Cache the engines list for the lifetime of the panel (don't re-fetch on repeated open/close)

### Engine change behaviour
When engine selector changes:
1. Call `POST /engine?name=<selected>`
2. On success: repopulate voice selector from response voices; if current `voiceName` absent, select first voice and call `onSettingsChange({ voiceName: firstVoice })`
3. On failure: revert selector; briefly highlight border red (CSS transition, 1.5 s)

### Voice change behaviour
Selecting a voice calls `onSettingsChange({ voiceName: selected })` → `saveSettings` → takes effect on the next `/synthesize` fetch. No playback interruption.

### Rate slider fix
The floating UI rate slider is corrected to **min 0.5, max 3, step 0.1** to match the options page and server clamp.

### `FloatingUI` new public method
`updateSettings(settings: Settings)` replaces the inline population in `loadChunks` — called by `index.ts` to keep the panel in sync when settings change externally (e.g. from the options page in another tab).

---

## Error Handling Summary

| Scenario | Behaviour |
|----------|-----------|
| `GET /engines` or `GET /engine` fails on load | Engine selector disabled (`— unavailable —`); voice selector shows saved `voiceName` as single option |
| `POST /engine` fails | Selector reverts to previous value; inline error shown |
| Saved `voiceName` not in new engine's voice list | First available voice auto-selected and saved |
| Server URL unreachable | Both selectors show unavailable state; other settings still saveable |

---

## Player Continuity

Switching engine mid-playback does not stop playback. In-flight `/synthesize` requests complete on the old engine (server handles this via `EngineRef`). New synthesis calls use the new engine and voice from the next fetch onward.

---

## Files Changed

| File | Change |
|------|--------|
| `src/server/server.py` | Add `KNOWN_ENGINES`, `GET /engines` endpoint, update `_build_engine` validation |
| `src/server/tests/test_server.py` | Tests for `GET /engines` |
| `src/extension/options/index.html` | Add engine selector, show-preview checkbox; fix rate slider range |
| `src/extension/options/main.ts` | Replace `fetchVoices`/`GET /voices` with `fetchEngineState`/`GET /engine`+`GET /engines`; engine change handler; fix rate range |
| `src/extension/content/ui.ts` | Add engine + voice selectors; fix rate slider range; add `updateSettings` method |
| `src/extension/content/index.ts` | Wire up new `onEngineChange`/`onVoiceChange` callbacks from `FloatingUI` |

---

## Out of Scope

- Storing engine preference in `browser.storage.local`
- Streaming audio
- Non-English voices for `kokoro1`
- Any changes to the `/synthesize` or `/voices` server endpoints

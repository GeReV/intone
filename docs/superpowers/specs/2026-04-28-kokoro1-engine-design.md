# Kokoro 1.0 Engine Design

**Date:** 2026-04-28
**Scope:** Add Kokoro v1.0 (`hexgrad/Kokoro-82M`) as a second TTS engine alongside the existing Kokoro 0.19 engine, with runtime hot-swap support.

---

## Context

The server currently runs a single TTS engine selected at startup via `--engine` / `SERVER_ENGINE`. The existing engine (`kokoro`) loads a local `.pth` model file and supports 11 English voices. Kokoro 1.0 is a newer model released via the `kokoro` pip package with 54 voices across 9 languages — this design adds it as `kokoro1`, scoped to its 20 American English voices.

---

## Architecture

### New engine package

```
engines/
  kokoro/     ← existing (v0.19)
  kokoro1/    ← new (v1.0)
    __init__.py   re-exports Kokoro1Engine
    engine.py     Kokoro1Engine implementation
```

`Kokoro1Engine` satisfies the existing `TTSEngine` protocol (`synthesize`, `voices`) unchanged.

### Mutable engine reference

`create_app` currently closes over a fixed engine. Replace it with a thin `EngineRef` wrapper:

```python
class EngineRef:
    def __init__(self, engine: TTSEngine) -> None:
        self.current = engine
```

All Flask routes read `engine_ref.current`. This makes the reference swappable without touching route logic.

### New endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/engine` | Returns `{"engine": "<name>", "voices": [...]}` for the active engine |
| `POST` | `/engine?name=<name>` | Hot-swaps to the named engine |

`POST /engine` is synchronous — it blocks until the new engine is fully initialized, then atomically replaces `engine_ref.current`. In-flight synthesis requests on the old engine complete normally (they already hold a local reference). A `threading.Lock` prevents concurrent swaps racing each other.

Returns `200 {"engine": "<name>", "voices": [...]}` on success, `400` for unknown engine names, `500` if initialization fails.

---

## Kokoro1Engine

**Init:** Creates one `KPipeline(lang_code='a')` (American English) eagerly at construction time. The `kokoro` package auto-downloads model weights to the HuggingFace cache on first use.

**Voices:** 20 American English voices declared as a constant:
```
af_heart, af_alloy, af_aoede, af_bella, af_jessica, af_kore,
af_nicole, af_nova, af_river, af_sarah, af_sky,
am_adam, am_echo, am_eric, am_fenrir, am_liam,
am_michael, am_onyx, am_puck, am_santa
```

**Synthesize:** Acquires a lock, calls `pipeline(text, voice=voice, speed=rate)`, iterates the generator concatenating all `audio` chunks into a single numpy array, encodes to OGG via `soundfile`. Same output contract as the existing engine.

The lock is conservative — `KPipeline` thread-safety is not documented.

---

## Dependencies

**`pyproject.toml`:** Add `kokoro>=0.9.2`. No torch conflict — the `kokoro` package (0.9.4) has no torch version floor and is compatible with our pinned `torch>=2.0,<2.4`.

**Dockerfile:** No changes needed. `espeak-ng` (required by `kokoro`) is already installed.

**`compose.yml`:** Add a named volume `hf_cache` mounted at `/root/.cache/huggingface` to persist auto-downloaded model weights across container restarts.

---

## `server.py` changes

1. Introduce `EngineRef` and thread-safe swap logic.
2. Extend `_build_engine` with `"kokoro1"` → `Kokoro1Engine`.
3. Add `GET /engine` and `POST /engine` routes.
4. Update help text in `_build_engine` error message to list both engines.

---

## Out of scope

- British English or other language pipelines (can be added later by extending `Kokoro1Engine`)
- Streaming audio responses
- Pre-loading both engines at startup

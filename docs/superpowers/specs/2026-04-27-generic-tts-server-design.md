# Generic TTS Server — Design Spec

**Date:** 2026-04-27  
**Location:** `src/server/`  
**Replaces:** `src/kokoro-tts/`

---

## Overview

A self-contained, Dockerised HTTP server that exposes a generic TTS API. The TTS backend is pluggable via a Python `Protocol`; the default implementation uses Kokoro. Supports HTTPS via mkcert-issued certs mounted as a Docker volume, and handles CORS globally via `flask-cors`.

---

## Project Layout

```
src/server/
├── server.py              # Flask app: routes, HTTPS setup, CORS, engine wiring
├── engine.py              # TTSEngine Protocol definition
├── engines/
│   └── kokoro.py          # KokoroEngine implementation
├── kokoro.py              # Kokoro model inference (from kokoro-tts)
├── models.py              # Model builder (from kokoro-tts)
├── istftnet.py            # iSTFTNet architecture (from kokoro-tts)
├── plbert.py              # PL-BERT (from kokoro-tts)
├── cleaners.py            # Text cleaning utilities
├── utils/                 # NER / text utilities
├── voices/                # Voice .pt files
├── dictsource/            # eSpeak custom dictionary
├── Dockerfile
├── compose.yml
├── requirements.txt
└── .dockerignore
```

The container is fully self-contained. No dependency on `src/kokoro-tts/` at runtime.

---

## API

### `GET /synthesize`

Synthesises speech from text.

| Parameter | Type   | Required | Default | Description                  |
|-----------|--------|----------|---------|------------------------------|
| `text`    | string | yes      | —       | Text to synthesise           |
| `voice`   | string | no       | `"af"`  | Voice name (engine-specific) |
| `rate`    | float  | no       | `1.0`   | Speed multiplier (0.5 – 2.0) |

**Responses:**
- `200 audio/ogg` — synthesised audio
- `400` — `text` missing/empty, or `voice` not in `engine.voices()`
- `500` — synthesis error

### `GET /voices`

Returns the list of voice names the active engine supports.

**Response:** `200 application/json` — `["af", "af_bella", "am_adam", ...]`

### CORS

All responses carry `Access-Control-Allow-Origin: *`, applied globally via `flask-cors`. No per-route header setting.

---

## Engine Interface

Defined in `engine.py` as a `typing.Protocol` (structural typing — no inheritance required):

```python
class TTSEngine(Protocol):
    def synthesize(self, text: str, voice: str, rate: float) -> bytes: ...
    def voices(self) -> list[str]: ...
```

`synthesize` returns raw OGG audio bytes. Any class implementing these two methods is a valid engine. The server selects the engine at startup via `--engine <name>` (default: `kokoro`).

---

## KokoroEngine

Implemented in `engines/kokoro.py`.

- `__init__(device: str)` — loads the model (`kokoro-v0_19.pth`) and preloads all voicepacks from `voices/*.pt` into memory at startup. Raises if the voices directory is missing or empty.
- `voices() -> list[str]` — returns the fixed list of supported Kokoro voices.
- `synthesize(text, voice, rate) -> bytes` — acquires a `threading.Lock` for the duration of inference, runs the Kokoro pipeline, encodes to OGG via `soundfile`, returns bytes.

The lock is an instance-level `threading.Lock`. It serialises concurrent requests to the Kokoro model, which does not handle parallelism safely. Other engine implementations are not affected.

---

## HTTPS

At startup, `server.py` checks for `/certs/cert.pem` and `/certs/key.pem`:

- If both exist: Flask starts with `ssl_context=('/certs/cert.pem', '/certs/key.pem')`.
- If either is missing: Flask starts in plain HTTP mode; a warning is logged.

Certs are generated with `mkcert` and mounted read-only into the container.

---

## Docker

**Base image:** `nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04`

**Build steps** (same pattern as `kokoro-tts`):
1. Install system deps: `espeak-ng`, `libsndfile1`, `python3`, `openjdk-17-jre-headless`
2. Create `.venv`
3. Install NLTK + download popular corpora
4. Download and unpack Stanford NER
5. `pip install -r requirements.txt`
6. `COPY . .`
7. Compile eSpeak custom dictionary: `cd dictsource && espeak-ng --compile=en`

**`CMD`:** `python3 server.py --engine kokoro --cuda`

**`compose.yml`:**
- Port: `5000:5000` by default; change the host-side port to `5443` when serving HTTPS (the container always listens on 5000)
- Volume: `./certs:/certs:ro`
- Env vars: `SERVER_VOICE` (default voice, default `af`), `SERVER_CUDA` (set to `1` to enable GPU), `SERVER_ENGINE` (engine name, default `kokoro`)
- GPU reservation: 1 NVIDIA device
- Restart policy: `unless-stopped`

---

## Adding a New Engine

1. Create `engines/<name>.py` with a class implementing `TTSEngine` (no base class needed).
2. Register the name → class mapping in `server.py`.
3. Pass `--engine <name>` at startup (or set the `SERVER_ENGINE` env var in `compose.yml`).

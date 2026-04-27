# Generic TTS Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create `src/server/` — a self-contained, Docker-deployable Flask TTS server with a pluggable engine Protocol, HTTPS support, CORS, and a Kokoro default backend.

**Architecture:** A Flask app factory (`create_app(engine)`) accepts any object satisfying the `TTSEngine` Protocol, wires up `/synthesize` and `/voices` routes with global CORS, and detects TLS certs at `/certs/` on startup. `KokoroEngine` wraps the Kokoro model, preloads all voicepacks at startup, and serialises inference calls with a `threading.Lock`.

**Tech Stack:** Python 3.11, Flask, flask-cors, soundfile, torch, pytest (tests only)

---

## File Map

| File | Role |
|------|------|
| `src/server/engine.py` | `TTSEngine` Protocol definition |
| `src/server/engines/__init__.py` | Empty package marker |
| `src/server/engines/kokoro.py` | `KokoroEngine` — model loading, lock, synthesize |
| `src/server/server.py` | Flask app factory, routes, HTTPS, engine registry |
| `src/server/pytest.ini` | Configures pytest path so `import engine` works from tests |
| `src/server/tests/conftest.py` | Shared `MockEngine` fixture |
| `src/server/tests/test_engine.py` | Protocol compliance tests |
| `src/server/tests/test_kokoro_engine.py` | KokoroEngine unit tests (mocked model) |
| `src/server/tests/test_server.py` | Flask route tests (mock engine) |
| `src/server/requirements.txt` | Pinned runtime deps (kokoro-tts + flask-cors) |
| `src/server/requirements-dev.txt` | pytest for local test runs |
| `src/server/Dockerfile` | nvidia/cuda base, venv, espeak, Stanford NER, pip install |
| `src/server/compose.yml` | GPU service, cert volume, env vars |
| `src/server/.dockerignore` | Exclude venv, pycache, voices, weights |
| `src/server/.gitignore` | Exclude voices/*.pt, *.pth, __pycache__, .venv |
| Copied from `src/kokoro-tts/`: `kokoro.py`, `models.py`, `istftnet.py`, `plbert.py`, `mix.py`, `cleaners.py`, `config.json`, `utils/`, `dictsource/` | Kokoro model code (self-contained copy) |

---

## Task 1: Scaffold directory and copy Kokoro model files

**Files:**
- Create: `src/server/engines/__init__.py`
- Create: `src/server/tests/__init__.py`
- Create: `src/server/pytest.ini`
- Create: `src/server/requirements-dev.txt`
- Create: `src/server/.gitignore`
- Copy: model files from `src/kokoro-tts/`

- [ ] **Step 1: Create directories**

```bash
mkdir -p src/server/engines src/server/tests
```

- [ ] **Step 2: Create empty package markers**

```bash
touch src/server/engines/__init__.py src/server/tests/__init__.py
```

- [ ] **Step 3: Copy Kokoro model code from kokoro-tts**

```bash
cp src/kokoro-tts/kokoro.py   src/server/kokoro.py
cp src/kokoro-tts/models.py   src/server/models.py
cp src/kokoro-tts/istftnet.py src/server/istftnet.py
cp src/kokoro-tts/plbert.py   src/server/plbert.py
cp src/kokoro-tts/mix.py      src/server/mix.py
cp src/kokoro-tts/cleaners.py src/server/cleaners.py
cp src/kokoro-tts/config.json src/server/config.json
cp -r src/kokoro-tts/utils/   src/server/utils/
cp -r src/kokoro-tts/dictsource/ src/server/dictsource/
```

- [ ] **Step 4: Write `src/server/pytest.ini`**

```ini
[pytest]
pythonpath = .
testpaths = tests
```

- [ ] **Step 5: Write `src/server/requirements-dev.txt`**

```
pytest==8.3.4
```

- [ ] **Step 6: Write `src/server/.gitignore`**

```
*.pt
*.pth
__pycache__/
.venv/
stanford-ner-*/
voices/
```

- [ ] **Step 7: Commit**

```bash
git add src/server/
git commit -m "chore: scaffold src/server and copy kokoro model files"
```

---

## Task 2: TTSEngine Protocol

**Files:**
- Create: `src/server/engine.py`
- Create: `src/server/tests/test_engine.py`

- [ ] **Step 1: Write the failing test**

Create `src/server/tests/test_engine.py`:

```python
from engine import TTSEngine


def test_duck_typed_class_satisfies_protocol():
    class GoodEngine:
        def synthesize(self, text: str, voice: str, rate: float) -> bytes:
            return b""

        def voices(self) -> list[str]:
            return ["v1"]

    assert isinstance(GoodEngine(), TTSEngine)


def test_class_missing_synthesize_fails_protocol():
    class BadEngine:
        def voices(self) -> list[str]:
            return []

    assert not isinstance(BadEngine(), TTSEngine)


def test_class_missing_voices_fails_protocol():
    class BadEngine:
        def synthesize(self, text: str, voice: str, rate: float) -> bytes:
            return b""

    assert not isinstance(BadEngine(), TTSEngine)
```

- [ ] **Step 2: Run the test — expect failure**

```bash
cd src/server && python -m pytest tests/test_engine.py -v
```

Expected: `ModuleNotFoundError: No module named 'engine'`

- [ ] **Step 3: Write `src/server/engine.py`**

```python
from typing import Protocol, runtime_checkable


@runtime_checkable
class TTSEngine(Protocol):
    def synthesize(self, text: str, voice: str, rate: float) -> bytes: ...
    def voices(self) -> list[str]: ...
```

- [ ] **Step 4: Run the test — expect pass**

```bash
cd src/server && python -m pytest tests/test_engine.py -v
```

Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add src/server/engine.py src/server/tests/test_engine.py
git commit -m "feat: add TTSEngine Protocol"
```

---

## Task 3: KokoroEngine

**Files:**
- Create: `src/server/engines/kokoro.py`
- Create: `src/server/tests/conftest.py`
- Create: `src/server/tests/test_kokoro_engine.py`

- [ ] **Step 1: Write `src/server/tests/conftest.py`** (shared mock for later tasks)

```python
import pytest


class MockEngine:
    def voices(self) -> list[str]:
        return ["af", "af_bella"]

    def synthesize(self, text: str, voice: str, rate: float) -> bytes:
        return b"fake_ogg_audio"


@pytest.fixture
def mock_engine() -> MockEngine:
    return MockEngine()
```

- [ ] **Step 2: Write the failing tests**

Create `src/server/tests/test_kokoro_engine.py`:

```python
import threading
from unittest.mock import MagicMock, patch

import numpy as np
import pytest


KOKORO_VOICES = [
    "af", "af_bella", "af_sarah", "am_adam", "am_michael",
    "bf_emma", "bf_isabella", "bm_george", "bm_lewis",
    "af_nicole", "af_sky",
]


@pytest.fixture
def engine():
    mock_voicepack = MagicMock()
    mock_voicepack.to.return_value = mock_voicepack

    with patch("engines.kokoro.build_model", return_value=MagicMock()), \
         patch("engines.kokoro.torch") as mock_torch:
        mock_torch.load.return_value = mock_voicepack
        from engines.kokoro import KokoroEngine
        yield KokoroEngine(device="cpu")


def test_voices_returns_all_kokoro_voices(engine):
    result = engine.voices()
    assert isinstance(result, list)
    for v in KOKORO_VOICES:
        assert v in result


def test_voices_returns_list_of_strings(engine):
    result = engine.voices()
    assert all(isinstance(v, str) for v in result)


def test_has_threading_lock(engine):
    assert isinstance(engine._lock, threading.Lock)


def test_synthesize_returns_bytes(engine):
    fake_audio = np.zeros(100, dtype=np.float32)

    def mock_sf_write(buf, data, samplerate, format):
        buf.write(b"fake_ogg")

    with patch("engines.kokoro.clean", return_value="hello"), \
         patch("engines.kokoro.generate", return_value=fake_audio), \
         patch("engines.kokoro.sf.write", side_effect=mock_sf_write):
        result = engine.synthesize("hello", "af", 1.0)

    assert isinstance(result, bytes)
    assert result == b"fake_ogg"


def test_synthesize_unknown_voice_raises(engine):
    with pytest.raises(KeyError):
        engine.synthesize("hello", "not_a_real_voice", 1.0)


def test_synthesize_cleans_text(engine):
    fake_audio = np.zeros(100, dtype=np.float32)
    captured = {}

    def mock_sf_write(buf, data, samplerate, format):
        buf.write(b"x")

    with patch("engines.kokoro.clean", return_value="cleaned text") as mock_clean, \
         patch("engines.kokoro.generate", return_value=fake_audio) as mock_gen, \
         patch("engines.kokoro.sf.write", side_effect=mock_sf_write):
        engine.synthesize("raw text", "af", 1.0)
        mock_clean.assert_called_once_with("raw text")
        _, kwargs = mock_gen.call_args
        assert kwargs["text"] == "cleaned text"
```

- [ ] **Step 3: Run the tests — expect failure**

```bash
cd src/server && python -m pytest tests/test_kokoro_engine.py -v
```

Expected: `ModuleNotFoundError: No module named 'engines.kokoro'`

- [ ] **Step 4: Write `src/server/engines/kokoro.py`**

```python
import io
import threading

import soundfile as sf
import torch

from cleaners import clean
from kokoro import SAMPLE_RATE, generate
from models import build_model

MODEL_NAME = "kokoro-v0_19.pth"

VOICES: list[str] = [
    "af",
    "af_bella", "af_sarah", "am_adam", "am_michael",
    "bf_emma", "bf_isabella", "bm_george", "bm_lewis",
    "af_nicole", "af_sky",
]


class KokoroEngine:
    def __init__(self, device: str = "cpu") -> None:
        self._device = device
        self._lock = threading.Lock()
        self._model = build_model(MODEL_NAME, device)
        self._voicepacks = {
            name: torch.load(f"voices/{name}.pt", weights_only=True).to(device)
            for name in VOICES
        }

    def voices(self) -> list[str]:
        return list(VOICES)

    def synthesize(self, text: str, voice: str, rate: float) -> bytes:
        text = clean(text)
        voicepack = self._voicepacks[voice]
        with self._lock:
            audio_data = generate(
                self._model,
                text=text,
                voicepack=voicepack,
                lang=voice[0],
                speed=rate,
            )
        audio_io = io.BytesIO()
        sf.write(audio_io, audio_data, samplerate=SAMPLE_RATE, format="OGG")
        audio_io.seek(0)
        return audio_io.read()
```

- [ ] **Step 5: Run the tests — expect pass**

```bash
cd src/server && python -m pytest tests/test_kokoro_engine.py -v
```

Expected: `6 passed`

- [ ] **Step 6: Commit**

```bash
git add src/server/engines/kokoro.py src/server/tests/conftest.py src/server/tests/test_kokoro_engine.py
git commit -m "feat: add KokoroEngine with threading lock"
```

---

## Task 4: Flask server

**Files:**
- Create: `src/server/server.py`
- Create: `src/server/tests/test_server.py`

- [ ] **Step 1: Write the failing tests**

Create `src/server/tests/test_server.py`:

```python
import json

import pytest

from server import create_app


@pytest.fixture
def client(mock_engine):
    app = create_app(mock_engine)
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


def test_voices_returns_json_list(client):
    response = client.get("/voices")
    assert response.status_code == 200
    assert response.content_type == "application/json"
    data = json.loads(response.data)
    assert data == ["af", "af_bella"]


def test_synthesize_returns_ogg_audio(client):
    response = client.get("/synthesize?text=hello&voice=af&rate=1.0")
    assert response.status_code == 200
    assert response.content_type == "audio/ogg"
    assert response.data == b"fake_ogg_audio"


def test_synthesize_missing_text_returns_400(client):
    response = client.get("/synthesize")
    assert response.status_code == 400


def test_synthesize_empty_text_returns_400(client):
    response = client.get("/synthesize?text=   ")
    assert response.status_code == 400


def test_synthesize_unknown_voice_returns_400(client):
    response = client.get("/synthesize?text=hello&voice=not_real")
    assert response.status_code == 400


def test_synthesize_uses_default_voice(client):
    response = client.get("/synthesize?text=hello")
    assert response.status_code == 200


def test_synthesize_invalid_rate_falls_back_to_default(client):
    response = client.get("/synthesize?text=hello&rate=notanumber")
    assert response.status_code == 200


def test_synthesize_rate_clamped_below(client, mock_engine, monkeypatch):
    captured = {}

    def fake_synthesize(text, voice, rate):
        captured["rate"] = rate
        return b"x"

    monkeypatch.setattr(mock_engine, "synthesize", fake_synthesize)
    client.get("/synthesize?text=hello&rate=0.1")
    assert captured["rate"] == 0.5


def test_synthesize_rate_clamped_above(client, mock_engine, monkeypatch):
    captured = {}

    def fake_synthesize(text, voice, rate):
        captured["rate"] = rate
        return b"x"

    monkeypatch.setattr(mock_engine, "synthesize", fake_synthesize)
    client.get("/synthesize?text=hello&rate=5.0")
    assert captured["rate"] == 2.0


def test_cors_header_on_voices(client):
    response = client.get("/voices")
    assert "Access-Control-Allow-Origin" in response.headers


def test_cors_header_on_synthesize(client):
    response = client.get("/synthesize?text=hello")
    assert "Access-Control-Allow-Origin" in response.headers


def test_synthesis_error_returns_500(mock_engine, monkeypatch):
    def boom(text, voice, rate):
        raise RuntimeError("model exploded")

    monkeypatch.setattr(mock_engine, "synthesize", boom)
    app = create_app(mock_engine)
    app.config["TESTING"] = True
    with app.test_client() as c:
        response = c.get("/synthesize?text=hello")
    assert response.status_code == 500
```

- [ ] **Step 2: Run the tests — expect failure**

```bash
cd src/server && python -m pytest tests/test_server.py -v
```

Expected: `ModuleNotFoundError: No module named 'server'`

- [ ] **Step 3: Write `src/server/server.py`**

```python
import argparse
import io
import logging
import os
from pathlib import Path

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

from engine import TTSEngine

_LOGGER = logging.getLogger(__name__)

CERT_PATH = Path("/certs/cert.pem")
KEY_PATH = Path("/certs/key.pem")

DEFAULT_VOICE = os.environ.get("SERVER_VOICE", "af")


def create_app(engine: TTSEngine) -> Flask:
    app = Flask(__name__)
    CORS(app)

    @app.route("/voices", methods=["GET"])
    def get_voices():
        return jsonify(engine.voices())

    @app.route("/synthesize", methods=["GET"])
    def synthesize():
        text = request.args.get("text", "").strip()
        if not text:
            return "text parameter is required", 400

        voice = request.args.get("voice", DEFAULT_VOICE)
        if voice not in engine.voices():
            return f"unknown voice: {voice}", 400

        try:
            rate = float(request.args.get("rate", "1.0"))
        except ValueError:
            rate = 1.0
        rate = max(0.5, min(2.0, rate))

        try:
            audio_bytes = engine.synthesize(text, voice, rate)
        except Exception:
            _LOGGER.exception("Synthesis failed")
            return "Synthesis failed", 500

        return send_file(io.BytesIO(audio_bytes), mimetype="audio/ogg")

    return app


def _build_engine(name: str, device: str) -> TTSEngine:
    if name == "kokoro":
        from engines.kokoro import KokoroEngine
        return KokoroEngine(device=device)
    raise ValueError(f"Unknown engine: {name!r}. Available: kokoro")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=5000)
    parser.add_argument("--engine", default=os.environ.get("SERVER_ENGINE", "kokoro"))
    parser.add_argument(
        "--cuda",
        action="store_true",
        default=os.environ.get("SERVER_CUDA", "").strip() == "1",
    )
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.DEBUG if args.debug else logging.INFO)

    device = "cuda" if args.cuda else "cpu"
    engine = _build_engine(args.engine, device)
    _LOGGER.info("Engine %r loaded on %s", args.engine, device)

    app = create_app(engine)

    ssl_context = None
    if CERT_PATH.exists() and KEY_PATH.exists():
        ssl_context = (str(CERT_PATH), str(KEY_PATH))
        _LOGGER.info("HTTPS enabled (certs at %s)", CERT_PATH.parent)
    else:
        _LOGGER.warning("No certs at /certs — running plain HTTP")

    app.run(host=args.host, port=args.port, ssl_context=ssl_context)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the tests — expect pass**

```bash
cd src/server && python -m pytest tests/test_server.py -v
```

Expected: `13 passed`

- [ ] **Step 5: Run the full test suite**

```bash
cd src/server && python -m pytest -v
```

Expected: all tests pass (Protocol + KokoroEngine mocked + server routes)

- [ ] **Step 6: Commit**

```bash
git add src/server/server.py src/server/tests/test_server.py
git commit -m "feat: add Flask server with /synthesize and /voices routes"
```

---

## Task 5: Infrastructure files

**Files:**
- Create: `src/server/requirements.txt`
- Create: `src/server/Dockerfile`
- Create: `src/server/compose.yml`
- Create: `src/server/.dockerignore`

- [ ] **Step 1: Write `src/server/requirements.txt`**

Copy from `src/kokoro-tts/requirements.txt` and append `flask-cors`:

```bash
cp src/kokoro-tts/requirements.txt src/server/requirements.txt
echo "flask-cors==5.0.0" >> src/server/requirements.txt
```

- [ ] **Step 2: Write `src/server/Dockerfile`**

```dockerfile
# syntax=docker/dockerfile:1

ARG BASE=nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04
FROM ${BASE}

RUN apt-get update && \
  apt-get upgrade -y && \
  apt-get install -y --no-install-recommends \
  build-essential git wget unzip \
  espeak-ng \
  libsndfile1 \
  openjdk-17-jre-headless \
  python3 python3-dev python3-pip python3-venv python3-wheel \
  && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .

RUN python3 -m venv .venv

RUN .venv/bin/pip3 install nltk inflect num2words && \
  .venv/bin/python3 -m nltk.downloader popular

ARG STANFORD_NER_ZIP=stanford-ner-4.2.0.zip
ARG STANFORD_DIR=/usr/share/java/stanford-ner
RUN mkdir -p $STANFORD_DIR && \
  cd $STANFORD_DIR && \
  wget "https://nlp.stanford.edu/software/$STANFORD_NER_ZIP" && \
  unzip $STANFORD_NER_ZIP && \
  rm $STANFORD_NER_ZIP && \
  cp -r ./stanford-ner-*/* . && rm -rf ./stanford-ner-*

ENV CLASSPATH=$STANFORD_DIR
ENV STANFORD_MODELS="$STANFORD_DIR/classifiers"

RUN .venv/bin/pip3 install -r requirements.txt

COPY . .

RUN cd dictsource && espeak-ng --compile=en

CMD .venv/bin/python3 server.py
```

- [ ] **Step 3: Write `src/server/compose.yml`**

```yaml
services:
  server:
    build:
      context: .
    environment:
      - SERVER_ENGINE=kokoro
      - SERVER_VOICE=af
      - SERVER_CUDA=1
    ports:
      - 5000:5000
    volumes:
      - ./certs:/certs:ro
    restart: unless-stopped
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

- [ ] **Step 4: Write `src/server/.dockerignore`**

```
.venv
__pycache__
*.pyc
*.pth
*.pt
voices/
stanford-ner-*/
tests/
.gitignore
.dockerignore
```

- [ ] **Step 5: Commit**

```bash
git add src/server/requirements.txt src/server/Dockerfile src/server/compose.yml src/server/.dockerignore
git commit -m "feat: add Dockerfile and compose for generic TTS server"
```

---

## Done

The server is ready. To run locally without Docker (no GPU, no model):

```bash
cd src/server
python -m pytest -v   # all tests pass with mocked Kokoro
```

To build and run the container (requires `voices/` and `kokoro-v0_19.pth` copied in):

```bash
cd src/server
# place kokoro-v0_19.pth and voices/*.pt here first
docker compose up --build
# GET http://localhost:5000/voices
# GET http://localhost:5000/synthesize?text=Hello+world&voice=af&rate=1.0
```

To enable HTTPS: place `cert.pem` and `key.pem` in `src/server/certs/` (or mount them). The server detects them automatically and switches to TLS — no restart needed after a fresh build.

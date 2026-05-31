# Hebrew TTS Design

**Date:** 2026-05-30  
**Status:** Approved

## Overview

Add Hebrew text-to-speech support to the Intone TTS server using renikud (G2P) and StyleTTS2 ONNX (acoustic synthesis), surfaced via a new `auto` engine that transparently routes English and Hebrew text to the appropriate sub-engine.

No extension code changes are required.

## Components

### `engines/hebrew/engine.py` — `HebrewEngine`

Implements the `TTSEngine` protocol (`synthesize(text, voice, rate) -> bytes`, `voices() -> list[str]`).

**G2P:** `renikud_onnx.G2P` converts unvocalized Hebrew text to IPA. renikud is a 20 MB ONNX model — newer and higher-accuracy than phonikud (its predecessor by the same author).

**Synthesis:** `style_onnx.StyleTTS2` converts IPA to audio. The acoustic model (`libritts_hebrew.onnx`) is ~63.5 MB. Voice timbre is controlled by `.npy` style files; each file is exposed as one voice entry.

**Voice naming:** Style files are discovered from a configured model directory. File stem is prefixed with `he_` to avoid collisions with English voices (e.g. `636_female_style.npy` → `he_636_female`; if the creator provides named checkpoints, `shaul.npy` → `he_shaul`).

**GPU support:** Both ONNX Runtime sessions honor `device`. When `device="cuda"`, the engine requests `["CUDAExecutionProvider", "CPUExecutionProvider"]` (CUDA with CPU fallback) for the StyleTTS2 acoustic model *and* for `renikud_onnx.G2P`. Because `G2P` builds its own `InferenceSession` with no providers argument, the engine pins providers by briefly intercepting `InferenceSession` construction (`_build_g2p`). This requires the CUDA build of ONNX Runtime: the server depends on `onnxruntime-gpu` (CUDA 12 / cuDNN 9) and the Docker image uses a `nvidia/cuda:12.x-cudnn-devel` base.

**Thread safety:** A single `threading.Lock` guards synthesis calls, same pattern as `Kokoro1Engine`.

**Output format:** OGG, encoded via `soundfile`, matching the existing server response format.

### `engines/auto/engine.py` — `AutoEngine`

Wraps `Kokoro1Engine` and `HebrewEngine`. Both sub-engines are initialized lazily on first use.

`voices()` returns the union of both engines' voice lists.

`synthesize(text, voice, rate)`:
1. Run `_is_hebrew(text)` to detect language.
2. Select the matching sub-engine.
3. If the requested `voice` belongs to the selected engine, use it; otherwise fall back to the first voice of that engine.

### Language detection — `_is_hebrew(text, threshold=0.20)`

```
hebrew_count / total_alphabetic_count >= threshold
```

- Hebrew letters: U+05D0–U+05EA (alef through tav).
- Alphabetic characters: `str.isalpha()`.
- Returns `False` if the text has no alphabetic characters.
- Threshold of 0.20 (20%) correctly classifies Hebrew pages with embedded English (code, proper nouns, URLs) as Hebrew, while ignoring English articles that cite a Hebrew word or two.

### Voice routing table

| Text language | Requested voice | Engine used | Voice used |
|---|---|---|---|
| Hebrew | Hebrew (`he_*`) | `HebrewEngine` | requested |
| Hebrew | English | `HebrewEngine` | first Hebrew voice |
| English | English | `Kokoro1Engine` | requested |
| English | Hebrew (`he_*`) | `Kokoro1Engine` | first English voice |

## Model management

Models are downloaded on first `HebrewEngine` initialization. The G2P model comes from the Hugging Face Hub via `huggingface_hub.hf_hub_download`; the StyleTTS2 acoustic model and style vectors are **GitHub release assets** (not on HF) and are fetched via `urllib`. Files land in the HF cache / `SERVER_HEBREW_MODEL_DIR` — no new volume mounts needed.

| File | Source | Purpose |
|---|---|---|
| `model.onnx` | HF `thewh1teagle/renikud` | renikud G2P model |
| `libritts_hebrew.onnx` | GitHub release `thewh1teagle/style-onnx@model-files-v1.0` | StyleTTS2 acoustic model |
| `636_female_style.npy`, `707_male_style.npy`, `style_female1.npy`, `style_male1.npy` | GitHub release `thewh1teagle/style-onnx@model-files-v1.0` | Voice style vectors |

The model directory for the GitHub-release files is configurable via `SERVER_HEBREW_MODEL_DIR`, defaulting to `intone_hebrew/` under the HF cache (`HF_HOME`).

> **Note:** the original draft of this table assumed `renikud.onnx` and that the StyleTTS2 model + `.npy` styles lived on HF `phonikud-tts-checkpoints@model-files-v1.0`. None of those existed — the renikud file is `model.onnx`, and the StyleTTS2 assets are published as GitHub releases of `style-onnx`. The table above reflects the verified, working sources.

## Dependencies

Added to `pyproject.toml`:

- `renikud-onnx` — Hebrew G2P (ONNX-based, no PyTorch required)
- `style-onnx` — StyleTTS2 ONNX inference
- `onnxruntime-gpu` — ONNX Runtime with CUDA 11.8 support (compatible with the existing `nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04` base image)

`onnxruntime-gpu` replaces `onnxruntime` if present; it includes the CPU provider as a fallback so non-GPU environments continue to work.

## Server changes

**`server.py`:**
- Add `"hebrew"` and `"auto"` to `KNOWN_ENGINES`.
- Add two new cases in `_build_engine()`.

**`compose.yml`:**
- Default `SERVER_ENGINE` remains `kokoro` (no breaking change).
- Users opt into automatic language switching by setting `SERVER_ENGINE=auto`.

## Out of scope

- Per-voice style conditioning UI (style files are selected by voice name; no runtime style blending).
- Extension UI changes (engine selection remains a server-side concern).
- Languages other than Hebrew and English.
- Automatic model updates.

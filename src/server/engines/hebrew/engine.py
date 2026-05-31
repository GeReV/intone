import io
import logging
import os
import threading
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf

logger = logging.getLogger(__name__)

# renikud G2P (grapheme -> IPA) ships on the Hugging Face Hub as model.onnx.
RENIKUD_REPO = "thewh1teagle/renikud"
RENIKUD_FILENAME = "model.onnx"

# The StyleTTS2 acoustic model (IPA -> audio) and its style vectors are published
# as GitHub *release* assets of thewh1teagle/style-onnx (tag model-files-v1.0) —
# they are NOT on the Hugging Face Hub.
STYLE_ONNX_RELEASE = (
    "https://github.com/thewh1teagle/style-onnx/releases/download/model-files-v1.0"
)
STYLETTS2_MODEL = "libritts_hebrew.onnx"
STYLETTS2_STYLES = [
    "636_female_style.npy",
    "707_male_style.npy",
    "style_female1.npy",
    "style_male1.npy",
]


def _model_dir() -> Path:
    base = os.environ.get("SERVER_HEBREW_MODEL_DIR")
    if not base:
        hf_home = os.environ.get("HF_HOME") or str(Path.home() / ".cache" / "huggingface")
        base = os.path.join(hf_home, "intone_hebrew")
    path = Path(base)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _download(url: str, dest: Path) -> Path:
    if dest.exists():
        return dest
    logger.info("Downloading %s ...", url)
    tmp = dest.with_name(dest.name + ".tmp")
    urllib.request.urlretrieve(url, tmp)
    tmp.replace(dest)
    return dest


def _providers(device: str) -> list[str]:
    """ONNX Runtime execution providers for the requested device. CUDA is listed
    first with a CPU fallback; ORT silently drops CUDA (with a warning) when it is
    unavailable, so this is safe on a CPU-only onnxruntime build."""
    if device == "cuda":
        return ["CUDAExecutionProvider", "CPUExecutionProvider"]
    return ["CPUExecutionProvider"]


def _build_g2p(model_path: str, providers: list[str]):
    """Build renikud_onnx.G2P pinned to the given execution providers.

    G2P constructs its own ``ort.InferenceSession(model_path)`` with no providers
    hook, so we briefly intercept InferenceSession construction to inject them.
    Engine initialization is serialized behind the engine-build locks, so the
    temporary global patch cannot race with other session creation."""
    import onnxruntime as ort
    from renikud_onnx import G2P

    real_session = ort.InferenceSession
    created: dict[str, object] = {}

    def _with_providers(path, *args, **kwargs):
        kwargs.setdefault("providers", providers)
        session = real_session(path, *args, **kwargs)
        created["session"] = session
        return session

    ort.InferenceSession = _with_providers  # type: ignore[assignment]
    try:
        g2p = G2P(model_path)
    finally:
        ort.InferenceSession = real_session  # type: ignore[assignment]

    session = created.get("session")
    if session is not None:
        logger.info("renikud G2P providers: %s", session.get_providers())
    return g2p


def _load_models(device: str) -> tuple:
    import onnxruntime as ort
    from huggingface_hub import hf_hub_download
    from style_onnx import StyleTTS2

    providers = _providers(device)

    logger.info("Downloading renikud G2P model...")
    renikud_path = hf_hub_download(repo_id=RENIKUD_REPO, filename=RENIKUD_FILENAME)
    g2p = _build_g2p(renikud_path, providers)

    logger.info("Downloading StyleTTS2 Hebrew model...")
    model_dir = _model_dir()
    model_path = _download(f"{STYLE_ONNX_RELEASE}/{STYLETTS2_MODEL}", model_dir / STYLETTS2_MODEL)

    styles_npz = model_dir / "he_styles.npz"
    style_keys = [Path(f).stem for f in STYLETTS2_STYLES]

    if not styles_npz.exists():
        logger.info("Building combined styles .npz...")
        styles: dict[str, np.ndarray] = {}
        for filename in STYLETTS2_STYLES:
            path = _download(f"{STYLE_ONNX_RELEASE}/{filename}", model_dir / filename)
            styles[Path(filename).stem] = np.load(path)
        np.savez(str(styles_npz), **styles)

    session = ort.InferenceSession(str(model_path), providers=providers)
    logger.info("StyleTTS2 providers: %s", session.get_providers())
    tts = StyleTTS2.from_session(session, str(styles_npz))

    return g2p, tts, style_keys


class HebrewEngine:
    def __init__(self, device: str = "cpu") -> None:
        self._device = device
        self._lock = threading.Lock()
        self._g2p, self._tts, self._style_keys = _load_models(device)
        self._voices = sorted("he_" + k for k in self._style_keys)

    def voices(self) -> list[str]:
        return list(self._voices)

    def synthesize(self, text: str, voice: str, rate: float) -> bytes:
        key = voice.removeprefix("he_") if voice.startswith("he_") else ""
        if key not in self._style_keys:
            key = self._style_keys[0]

        with self._lock:
            phonemes = self._g2p.phonemize(text)
            samples, sr = self._tts.create(phonemes, style=key, speed=rate)

        audio_io = io.BytesIO()
        sf.write(audio_io, samples, samplerate=sr, format="OGG")
        audio_io.seek(0)
        return audio_io.read()

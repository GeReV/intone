import io
import logging
import threading
from pathlib import Path

import numpy as np
import soundfile as sf

logger = logging.getLogger(__name__)

RENIKUD_REPO = "thewh1teagle/renikud"
RENIKUD_FILENAME = "renikud.onnx"

STYLETTS2_REPO = "thewh1teagle/phonikud-tts-checkpoints"
STYLETTS2_REVISION = "model-files-v1.0"
STYLETTS2_MODEL = "libritts_hebrew.onnx"
STYLETTS2_STYLES = [
    "636_female_style.npy",
    "707_male_style.npy",
    "style_female1.npy",
    "style_male1.npy",
]


def _load_models(device: str) -> tuple:
    import onnxruntime as ort
    from huggingface_hub import hf_hub_download
    from renikud_onnx import G2P
    from style_onnx import StyleTTS2

    logger.info("Downloading renikud G2P model...")
    renikud_path = hf_hub_download(repo_id=RENIKUD_REPO, filename=RENIKUD_FILENAME)
    g2p = G2P(renikud_path)

    logger.info("Downloading StyleTTS2 Hebrew model...")
    model_path = Path(
        hf_hub_download(repo_id=STYLETTS2_REPO, filename=STYLETTS2_MODEL, revision=STYLETTS2_REVISION)
    )
    snapshot_dir = model_path.parent

    styles_npz = snapshot_dir / "he_styles.npz"
    style_keys = [Path(f).stem for f in STYLETTS2_STYLES]

    if not styles_npz.exists():
        logger.info("Building combined styles .npz...")
        styles: dict[str, np.ndarray] = {}
        for filename in STYLETTS2_STYLES:
            path = hf_hub_download(
                repo_id=STYLETTS2_REPO, filename=filename, revision=STYLETTS2_REVISION
            )
            styles[Path(filename).stem] = np.load(path)
        np.savez(str(styles_npz), **styles)

    session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
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

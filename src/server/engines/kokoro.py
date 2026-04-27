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
        if voice not in self._voicepacks:
            raise ValueError(f"Unknown voice: {voice!r}")
        voicepack = self._voicepacks[voice]
        # Lock covers only inference; OGG encoding uses a fresh numpy array and is lock-free.
        with self._lock:
            audio_data = generate(
                self._model,
                text=text,
                voicepack=voicepack,
                lang=voice[0],  # 'a' = American English, 'b' = British English
                speed=rate,
            )
        audio_io = io.BytesIO()
        sf.write(audio_io, audio_data, samplerate=SAMPLE_RATE, format="OGG")
        audio_io.seek(0)
        return audio_io.read()

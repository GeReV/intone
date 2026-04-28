import io
import threading

import numpy as np
import soundfile as sf
from kokoro import KPipeline

SAMPLE_RATE = 24000

VOICES: list[str] = [
    "af_heart", "af_alloy", "af_aoede", "af_bella", "af_jessica", "af_kore",
    "af_nicole", "af_nova", "af_river", "af_sarah", "af_sky",
    "am_adam", "am_echo", "am_eric", "am_fenrir", "am_liam",
    "am_michael", "am_onyx", "am_puck", "am_santa",
]


class Kokoro1Engine:
    def __init__(self) -> None:
        self._pipeline = KPipeline(lang_code="a")
        self._lock = threading.Lock()

    def voices(self) -> list[str]:
        return list(VOICES)

    def synthesize(self, text: str, voice: str, rate: float) -> bytes:
        if voice not in VOICES:
            raise ValueError(f"Unknown voice: {voice!r}")
        with self._lock:
            chunks = [audio for _, _, audio in self._pipeline(text, voice=voice, speed=rate)]
        audio = np.concatenate(chunks)
        audio_io = io.BytesIO()
        sf.write(audio_io, audio, samplerate=SAMPLE_RATE, format="OGG")
        audio_io.seek(0)
        return audio_io.read()

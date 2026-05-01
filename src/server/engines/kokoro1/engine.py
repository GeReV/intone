import io
import threading

import numpy as np
import soundfile as sf

# misaki 0.9.x calls set_library() and set_data_path() on EspeakWrapper before
# importing kokoro.  Both are patched to no-ops for different reasons:
#
# set_library() already exists but we intentionally discard the argument:
#   espeakng_loader's bundled binary has the CI build path
#   (/home/runner/work/...) hardcoded as its espeak-ng-data dir, which doesn't
#   exist in this container.  Leaving _ESPEAK_LIBRARY=None causes phonemizer to
#   fall back to the system espeak-ng (installed via apt), which resolves its
#   own data path correctly.
#
# set_data_path() does not exist in phonemizer at all.  EspeakWrapper.data_path
# is an instance read-only property populated from the library's info() call
# after load — there is no class-level override mechanism to delegate to.
from phonemizer.backend.espeak.wrapper import EspeakWrapper
EspeakWrapper.set_library = classmethod(lambda cls, path: None)
if not hasattr(EspeakWrapper, "set_data_path"):
    EspeakWrapper.set_data_path = classmethod(lambda cls, path: None)

from kokoro import KPipeline

SAMPLE_RATE = 24000

VOICES: list[str] = [
    "af_heart", "af_alloy", "af_aoede", "af_bella", "af_jessica", "af_kore",
    "af_nicole", "af_nova", "af_river", "af_sarah", "af_sky",
    "am_adam", "am_echo", "am_eric", "am_fenrir", "am_liam",
    "am_michael", "am_onyx", "am_puck", "am_santa",
]


class Kokoro1Engine:
    def __init__(self, device: str = "cpu") -> None:
        self._pipeline = KPipeline(lang_code="a", device=device)
        self._lock = threading.Lock()

    def voices(self) -> list[str]:
        return list(VOICES)

    def synthesize(self, text: str, voice: str, rate: float) -> bytes:
        if voice not in VOICES:
            raise ValueError(f"Unknown voice: {voice!r}")
        with self._lock:
            # Lock covers only pipeline generation; concatenation and OGG encoding are lock-free.
            chunks = [audio for _, _, audio in self._pipeline(text, voice=voice, speed=rate)]
        if not chunks:
            return b""
        audio = np.concatenate(chunks)
        audio_io = io.BytesIO()
        sf.write(audio_io, audio, samplerate=SAMPLE_RATE, format="OGG")
        audio_io.seek(0)
        return audio_io.read()

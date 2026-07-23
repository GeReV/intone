import io
import logging
import re
import threading
from pathlib import Path

import numpy as np
import soundfile as sf

logger = logging.getLogger(__name__)

_EN_EXTRA = Path(__file__).parent.parent.parent / "dictsource" / "en_extra"

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
from misaki.espeak import EspeakFallback
from kokoro import KPipeline

SAMPLE_RATE = 24000

# Pass repo_id explicitly so KPipeline/KModel don't warn about defaulting it.
REPO_ID = "hexgrad/Kokoro-82M"

VOICES: list[str] = [
    "af_heart", "af_alloy", "af_aoede", "af_bella", "af_jessica", "af_kore",
    "af_nicole", "af_nova", "af_river", "af_sarah", "af_sky",
    "am_adam", "am_echo", "am_eric", "am_fenrir", "am_liam",
    "am_michael", "am_onyx", "am_puck", "am_santa",
]

class Kokoro1Engine:
    def __init__(self, device: str = "cpu") -> None:
        self._pipeline = KPipeline(lang_code="a", repo_id=REPO_ID, device=device)
        self._inject_custom_phonemes()
        self._lock = threading.Lock()

    def _inject_custom_phonemes(self) -> None:
        from utils.custom_phonemes import build_ipa_dict, parse_en_extra
        if not _EN_EXTRA.exists():
            logger.warning("en_extra not found at %s; skipping custom phoneme injection", _EN_EXTRA)
            return

        """Convert en_extra entries to misaki-format IPA using EspeakFallback."""
        if EspeakFallback is None:
            logger.warning("EspeakFallback unavailable; skipping custom phoneme injection")
            return

        try:
            import ctypes.util
            import subprocess
            lib_name = ctypes.util.find_library("espeak-ng")
            if lib_name:
                result = subprocess.run(["ldconfig", "-p"], capture_output=True, text=True)
                for line in result.stdout.splitlines():
                    if lib_name in line:
                        path = line.strip().split("=> ")[-1]
                        EspeakWrapper.set_library(path)
                        EspeakWrapper.set_data_path("")
                        break

            fallback = EspeakFallback(british=False)
        except Exception as e:
            logger.warning("Could not initialize EspeakFallback for custom phonemes: %s", e)
            return

        entries = parse_en_extra(str(_EN_EXTRA))
        ipa_dict = build_ipa_dict(fallback, entries)
        if ipa_dict:
            self._pipeline.g2p.lexicon.golds.update(ipa_dict)
            logger.info("Injected %d custom phoneme(s) into Kokoro1 G2P lexicon", len(ipa_dict))

    def voices(self) -> list[str]:
        return list(VOICES)

    def synthesize(self, text: str, voice: str, rate: float) -> bytes:
        if voice not in VOICES:
            raise ValueError(f"Unknown voice: {voice!r}")
        # KPipeline's default split_pattern=r'\n+' starts a new forward pass at
        # every newline, and concatenating those passes produces an audible
        # pause at each one. Extracted text retains interior \n / \n\n (see
        # content/extractor/hooks.ts), so collapse all whitespace runs to single
        # spaces to keep the chunk a single continuous utterance.
        text = re.sub(r"\s+", " ", text).strip()
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

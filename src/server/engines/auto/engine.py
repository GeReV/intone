import logging
import threading

logger = logging.getLogger(__name__)

_HEBREW_ALEF = ord("א")
_HEBREW_TAV = ord("ת")
_HEBREW_THRESHOLD = 0.20


def _is_hebrew(text: str, threshold: float = _HEBREW_THRESHOLD) -> bool:
    alphabetic = [c for c in text if c.isalpha()]
    if not alphabetic:
        return False
    hebrew_count = sum(1 for c in alphabetic if _HEBREW_ALEF <= ord(c) <= _HEBREW_TAV)
    return hebrew_count / len(alphabetic) >= threshold


class AutoEngine:
    def __init__(self, device: str = "cpu") -> None:
        self._device = device
        self._lock = threading.Lock()
        self._kokoro = None
        self._hebrew = None

    def _get_kokoro(self):
        if self._kokoro is None:
            with self._lock:
                if self._kokoro is None:
                    from engines.kokoro1 import Kokoro1Engine
                    self._kokoro = Kokoro1Engine(device=self._device)
                    logger.info("Kokoro1Engine loaded")
        return self._kokoro

    def _get_hebrew(self):
        if self._hebrew is None:
            with self._lock:
                if self._hebrew is None:
                    from engines.hebrew import HebrewEngine
                    self._hebrew = HebrewEngine(device=self._device)
                    logger.info("HebrewEngine loaded")
        return self._hebrew

    def voices(self) -> list[str]:
        return self._get_kokoro().voices() + self._get_hebrew().voices()

    def synthesize(self, text: str, voice: str, rate: float) -> bytes:
        if _is_hebrew(text):
            engine = self._get_hebrew()
        else:
            engine = self._get_kokoro()
        if voice not in engine.voices():
            voice = engine.voices()[0]
        return engine.synthesize(text, voice, rate)

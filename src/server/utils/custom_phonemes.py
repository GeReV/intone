import logging
import types

from phonemizer.backend.espeak.wrapper import EspeakWrapper

# misaki.espeak calls set_data_path() at import time, which doesn't exist in
# phonemizer — apply the same no-op patch used in engines/kokoro1/engine.py.
if not hasattr(EspeakWrapper, "set_data_path"):
    EspeakWrapper.set_data_path = classmethod(lambda cls, path: None)

try:
    from misaki.espeak import EspeakFallback
except Exception:
    EspeakFallback = None  # type: ignore[assignment,misc]

logger = logging.getLogger(__name__)


def parse_en_extra(path: str) -> list[tuple[str, list[str]]]:
    """Return (word, flags) pairs for en_extra entries with explicit phoneme overrides."""
    entries = []
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("//"):
                continue
            tokens = line.split()
            word = tokens[0]
            if word.startswith("("):
                continue
            if len(tokens) < 2 or tokens[1].startswith("$"):
                continue
            flags = [t for t in tokens[2:] if t.startswith("$")]
            entries.append((word, flags))
    return entries


def build_ipa_dict(entries: list[tuple[str, list[str]]]) -> dict[str, str]:
    """Convert en_extra entries to misaki-format IPA using EspeakFallback."""
    if EspeakFallback is None:
        logger.warning("EspeakFallback unavailable; skipping custom phoneme injection")
        return {}
    try:
        fallback = EspeakFallback(british=False)
    except Exception as e:
        logger.warning("Could not initialize EspeakFallback for custom phonemes: %s", e)
        return {}

    result: dict[str, str] = {}
    for word, flags in entries:
        if "$capital" in flags:
            espeak_word = word.capitalize()
            dict_key = word.capitalize()
        elif "$allcaps" in flags:
            espeak_word = word.upper()
            dict_key = word.lower()
        else:
            espeak_word = word
            dict_key = word.lower()

        try:
            ipa, _ = fallback(types.SimpleNamespace(text=espeak_word))
            if ipa:
                result[dict_key] = ipa
        except Exception as e:
            logger.warning("Failed to get IPA for %r: %s", word, e)

    return result

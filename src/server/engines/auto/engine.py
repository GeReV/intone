_HEBREW_ALEF = ord("א")
_HEBREW_TAV = ord("ת")
_HEBREW_THRESHOLD = 0.20


def _is_hebrew(text: str, threshold: float = _HEBREW_THRESHOLD) -> bool:
    alphabetic = [c for c in text if c.isalpha()]
    if not alphabetic:
        return False
    hebrew_count = sum(1 for c in alphabetic if _HEBREW_ALEF <= ord(c) <= _HEBREW_TAV)
    return hebrew_count / len(alphabetic) >= threshold

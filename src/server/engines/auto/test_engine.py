import pytest

from engines.auto.engine import _is_hebrew


def test_pure_hebrew_is_true():
    assert _is_hebrew("שלום עולם") is True


def test_pure_english_is_false():
    assert _is_hebrew("Hello world") is False


def test_hebrew_with_embedded_english_is_true():
    # Israeli page: Hebrew article with English proper nouns, ~60% Hebrew chars
    assert _is_hebrew("הממשלה הישראלית פגשה את Netanyahu בירושלים") is True


def test_english_with_one_hebrew_word_is_false():
    # English sentence quoting a single Hebrew word: ~5% Hebrew chars
    assert _is_hebrew("The word for peace in Hebrew is שלום and it is widely used") is False


def test_empty_string_is_false():
    assert _is_hebrew("") is False


def test_numbers_only_is_false():
    assert _is_hebrew("12345 67890") is False


def test_punctuation_only_is_false():
    assert _is_hebrew("!@#$%^&*()") is False


def test_exactly_at_threshold_is_true():
    # 2 Hebrew letters out of 10 alphabetic = 20% → True
    assert _is_hebrew("abcdefghשם") is True


def test_just_below_threshold_is_false():
    # 1 Hebrew letter out of 10 alphabetic = 10% → False
    assert _is_hebrew("abcdefghijש") is False


# ── AutoEngine tests ────────────────────────────────────────────────────────
import threading
from unittest.mock import MagicMock


def _make_mock_engine(voices: list[str]) -> MagicMock:
    eng = MagicMock()
    eng.voices.return_value = voices
    eng.synthesize.return_value = b"audio"
    return eng


def _make_auto(kokoro_voices: list[str], hebrew_voices: list[str]):
    """Build an AutoEngine with pre-set mock sub-engines, bypassing __init__."""
    from engines.auto.engine import AutoEngine
    auto = AutoEngine.__new__(AutoEngine)
    auto._device = "cpu"
    auto._lock = threading.Lock()
    auto._kokoro = _make_mock_engine(kokoro_voices)
    auto._hebrew = _make_mock_engine(hebrew_voices)
    return auto


def test_auto_voices_returns_union():
    auto = _make_auto(["af_adam", "am_echo"], ["he_636_female_style"])
    assert set(auto.voices()) == {"af_adam", "am_echo", "he_636_female_style"}


def test_auto_voices_kokoro_first():
    auto = _make_auto(["af_adam"], ["he_636_female_style"])
    voices = auto.voices()
    assert voices.index("af_adam") < voices.index("he_636_female_style")


def test_auto_routes_hebrew_text_to_hebrew_engine():
    auto = _make_auto(["af_adam"], ["he_636_female_style"])
    auto.synthesize("שלום עולם", "af_adam", 1.0)
    auto._hebrew.synthesize.assert_called_once_with("שלום עולם", "he_636_female_style", 1.0)
    auto._kokoro.synthesize.assert_not_called()


def test_auto_routes_english_text_to_kokoro():
    auto = _make_auto(["af_adam"], ["he_636_female_style"])
    auto.synthesize("Hello world", "af_adam", 1.0)
    auto._kokoro.synthesize.assert_called_once_with("Hello world", "af_adam", 1.0)
    auto._hebrew.synthesize.assert_not_called()


def test_auto_uses_requested_voice_when_it_matches_engine():
    auto = _make_auto(["af_adam", "am_echo"], ["he_636_female_style"])
    auto.synthesize("Hello world", "am_echo", 1.0)
    auto._kokoro.synthesize.assert_called_once_with("Hello world", "am_echo", 1.0)


def test_auto_falls_back_to_first_hebrew_voice_for_hebrew_text_with_english_voice():
    auto = _make_auto(["af_adam"], ["he_636_female_style", "he_707_male_style"])
    auto.synthesize("שלום עולם", "af_adam", 1.0)
    auto._hebrew.synthesize.assert_called_once_with("שלום עולם", "he_636_female_style", 1.0)


def test_auto_falls_back_to_first_kokoro_voice_for_english_text_with_hebrew_voice():
    auto = _make_auto(["af_adam", "am_echo"], ["he_636_female_style"])
    auto.synthesize("Hello world", "he_636_female_style", 1.0)
    auto._kokoro.synthesize.assert_called_once_with("Hello world", "af_adam", 1.0)


def test_auto_returns_audio_bytes():
    auto = _make_auto(["af_adam"], ["he_636_female_style"])
    result = auto.synthesize("Hello world", "af_adam", 1.0)
    assert result == b"audio"


def test_auto_has_threading_lock():
    auto = _make_auto(["af_adam"], ["he_636_female_style"])
    assert isinstance(auto._lock, type(threading.Lock()))

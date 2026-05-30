import sys
import threading
from unittest.mock import MagicMock, patch

import numpy as np
import pytest


STYLE_KEYS = ["636_female_style", "707_male_style", "style_female1", "style_male1"]
EXPECTED_VOICES = sorted("he_" + k for k in STYLE_KEYS)


@pytest.fixture
def engine(monkeypatch):
    mock_g2p = MagicMock()
    mock_g2p.phonemize.return_value = "ʃalˈom"

    mock_tts = MagicMock()
    mock_tts.create.return_value = (np.zeros(1000, dtype=np.float32), 24000)

    monkeypatch.delitem(sys.modules, "engines.hebrew", raising=False)
    monkeypatch.delitem(sys.modules, "engines.hebrew.engine", raising=False)

    with patch("engines.hebrew.engine._load_models", return_value=(mock_g2p, mock_tts, STYLE_KEYS)):
        from engines.hebrew import HebrewEngine
        eng = HebrewEngine(device="cpu")

    return eng


def test_voices_returns_he_prefixed_names(engine):
    assert engine.voices() == EXPECTED_VOICES


def test_voices_returns_sorted_list(engine):
    voices = engine.voices()
    assert voices == sorted(voices)


def test_voices_returns_copy(engine):
    assert engine.voices() is not engine.voices()


def test_has_threading_lock(engine):
    assert isinstance(engine._lock, type(threading.Lock()))


def test_synthesize_phonemizes_text(engine):
    with patch("engines.hebrew.engine.sf.write", side_effect=lambda buf, d, **kw: buf.write(b"x")):
        engine.synthesize("שלום", "he_636_female_style", 1.0)
    engine._g2p.phonemize.assert_called_once_with("שלום")


def test_synthesize_passes_style_key_and_speed(engine):
    with patch("engines.hebrew.engine.sf.write", side_effect=lambda buf, d, **kw: buf.write(b"x")):
        engine.synthesize("שלום", "he_636_female_style", 1.5)
    engine._tts.create.assert_called_once_with("ʃalˈom", style="636_female_style", speed=1.5)


def test_synthesize_returns_ogg_bytes(engine):
    sentinel = b"OggS_fake"
    with patch("engines.hebrew.engine.sf.write", side_effect=lambda buf, d, **kw: buf.write(sentinel)):
        result = engine.synthesize("שלום", "he_636_female_style", 1.0)
    assert result == sentinel


def test_synthesize_falls_back_on_unknown_voice(engine):
    with patch("engines.hebrew.engine.sf.write", side_effect=lambda buf, d, **kw: buf.write(b"x")):
        engine.synthesize("שלום", "he_nonexistent", 1.0)
    call_kwargs = engine._tts.create.call_args[1]
    assert call_kwargs["style"] == STYLE_KEYS[0]


def test_synthesize_encodes_ogg_at_24000hz(engine):
    captured = {}

    def capture_write(buf, data, samplerate, format):
        captured["samplerate"] = samplerate
        captured["format"] = format
        buf.write(b"x")

    with patch("engines.hebrew.engine.sf.write", side_effect=capture_write):
        engine.synthesize("שלום", "he_636_female_style", 1.0)

    assert captured["samplerate"] == 24000
    assert captured["format"] == "OGG"

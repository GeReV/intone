import sys
import threading
import types
from unittest.mock import MagicMock, patch

import numpy as np
import pytest


KOKORO_VOICES = [
    "af", "af_bella", "af_sarah", "am_adam", "am_michael",
    "bf_emma", "bf_isabella", "bm_george", "bm_lewis",
    "af_nicole", "af_sky",
]


@pytest.fixture
def engine(monkeypatch):
    for name in ("torch", "soundfile", "kokoro", "models", "cleaners"):
        if name not in sys.modules:
            monkeypatch.setitem(sys.modules, name, types.ModuleType(name))

    sys.modules["kokoro"].SAMPLE_RATE = 24000
    sys.modules["kokoro"].generate = MagicMock()
    sys.modules["models"].build_model = MagicMock()
    sys.modules["cleaners"].clean = MagicMock(side_effect=lambda x: x)
    sys.modules["soundfile"].write = MagicMock()

    monkeypatch.delitem(sys.modules, "engines.kokoro", raising=False)

    mock_voicepack = MagicMock()
    mock_voicepack.to.return_value = mock_voicepack

    with patch("engines.kokoro.build_model", return_value=MagicMock()), \
         patch("engines.kokoro.torch") as mock_torch:
        mock_torch.load.return_value = mock_voicepack
        from engines.kokoro import KokoroEngine
        yield KokoroEngine(device="cpu")


def test_voices_returns_all_kokoro_voices(engine):
    result = engine.voices()
    assert isinstance(result, list)
    for v in KOKORO_VOICES:
        assert v in result


def test_voices_returns_list_of_strings(engine):
    result = engine.voices()
    assert all(isinstance(v, str) for v in result)


def test_has_threading_lock(engine):
    assert isinstance(engine._lock, threading.Lock)


def test_synthesize_returns_bytes(engine):
    fake_audio = np.zeros(100, dtype=np.float32)

    def mock_sf_write(buf, data, samplerate, format):
        buf.write(b"fake_ogg")

    with patch("engines.kokoro.clean", return_value="hello"), \
         patch("engines.kokoro.generate", return_value=fake_audio), \
         patch("engines.kokoro.sf.write", side_effect=mock_sf_write):
        result = engine.synthesize("hello", "af", 1.0)

    assert isinstance(result, bytes)
    assert result == b"fake_ogg"


def test_synthesize_unknown_voice_raises(engine):
    with pytest.raises(KeyError):
        engine.synthesize("hello", "not_a_real_voice", 1.0)


def test_synthesize_cleans_text(engine):
    fake_audio = np.zeros(100, dtype=np.float32)

    def mock_sf_write(buf, data, samplerate, format):
        buf.write(b"x")

    with patch("engines.kokoro.clean", return_value="cleaned text") as mock_clean, \
         patch("engines.kokoro.generate", return_value=fake_audio) as mock_gen, \
         patch("engines.kokoro.sf.write", side_effect=mock_sf_write):
        engine.synthesize("raw text", "af", 1.0)
        mock_clean.assert_called_once_with("raw text")
        _, kwargs = mock_gen.call_args
        assert kwargs["text"] == "cleaned text"

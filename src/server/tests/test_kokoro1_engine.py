import sys
import threading
import types
from unittest.mock import MagicMock, patch, call

import numpy as np
import pytest

KOKORO1_VOICES = [
    "af_heart", "af_alloy", "af_aoede", "af_bella", "af_jessica", "af_kore",
    "af_nicole", "af_nova", "af_river", "af_sarah", "af_sky",
    "am_adam", "am_echo", "am_eric", "am_fenrir", "am_liam",
    "am_michael", "am_onyx", "am_puck", "am_santa",
]


@pytest.fixture
def engine(monkeypatch):
    mock_kokoro = types.ModuleType("kokoro")
    mock_pipeline_instance = MagicMock()
    mock_kokoro.KPipeline = MagicMock(return_value=mock_pipeline_instance)
    monkeypatch.setitem(sys.modules, "kokoro", mock_kokoro)
    monkeypatch.delitem(sys.modules, "engines.kokoro1", raising=False)
    monkeypatch.delitem(sys.modules, "engines.kokoro1.engine", raising=False)

    from engines.kokoro1 import Kokoro1Engine
    engine = Kokoro1Engine()
    engine._pipeline = mock_pipeline_instance
    return engine


def test_voices_returns_all_kokoro1_voices(engine):
    assert engine.voices() == KOKORO1_VOICES


def test_voices_returns_a_copy(engine):
    v1 = engine.voices()
    v2 = engine.voices()
    assert v1 == v2
    assert v1 is not v2


def test_has_threading_lock(engine):
    assert isinstance(engine._lock, type(threading.Lock()))


def test_synthesize_unknown_voice_raises(engine):
    with pytest.raises(ValueError, match="Unknown voice"):
        engine.synthesize("hello", "not_a_real_voice", 1.0)


def test_synthesize_empty_pipeline_returns_empty_bytes(engine):
    engine._pipeline.return_value = []
    result = engine.synthesize("hello", "af_heart", 1.0)
    assert result == b""


def test_synthesize_returns_bytes(engine):
    chunk1 = np.array([0.1, 0.2], dtype=np.float32)
    chunk2 = np.array([0.3, 0.4], dtype=np.float32)
    engine._pipeline.return_value = [("g1", "p1", chunk1), ("g2", "p2", chunk2)]

    def mock_sf_write(buf, data, samplerate, format):
        buf.write(b"fake_ogg")

    with patch("engines.kokoro1.engine.sf.write", side_effect=mock_sf_write):
        result = engine.synthesize("hello", "af_heart", 1.0)

    assert isinstance(result, bytes)
    assert result == b"fake_ogg"


def test_synthesize_concatenates_chunks(engine):
    chunk1 = np.array([0.1, 0.2], dtype=np.float32)
    chunk2 = np.array([0.3, 0.4], dtype=np.float32)
    engine._pipeline.return_value = [("g1", "p1", chunk1), ("g2", "p2", chunk2)]

    captured = {}

    def mock_sf_write(buf, data, samplerate, format):
        captured["data"] = data
        buf.write(b"x")

    with patch("engines.kokoro1.engine.sf.write", side_effect=mock_sf_write):
        engine.synthesize("hello", "af_heart", 1.0)

    np.testing.assert_array_equal(
        captured["data"], np.array([0.1, 0.2, 0.3, 0.4], dtype=np.float32)
    )


def test_synthesize_passes_voice_and_speed(engine):
    engine._pipeline.return_value = [("g", "p", np.zeros(10, dtype=np.float32))]

    with patch("engines.kokoro1.engine.sf.write", side_effect=lambda buf, d, **kw: buf.write(b"x")):
        engine.synthesize("hello", "af_heart", 1.5)

    engine._pipeline.assert_called_once_with("hello", voice="af_heart", speed=1.5)


def test_synthesize_ogg_samplerate(engine):
    engine._pipeline.return_value = [("g", "p", np.zeros(10, dtype=np.float32))]

    captured = {}

    def mock_sf_write(buf, data, samplerate, format):
        captured["samplerate"] = samplerate
        captured["format"] = format
        buf.write(b"x")

    with patch("engines.kokoro1.engine.sf.write", side_effect=mock_sf_write):
        engine.synthesize("hello", "af_heart", 1.0)

    assert captured["samplerate"] == 24000
    assert captured["format"] == "OGG"

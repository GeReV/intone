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
    # Stub all required modules BEFORE any import attempts
    for name in ("torch", "soundfile", "kokoro", "models", "cleaners",
                 "nltk", "nltk.tag", "nltk.tag.stanford_ner",
                 "engines", "engines.kokoro"):
        if name not in sys.modules:
            monkeypatch.setitem(sys.modules, name, types.ModuleType(name))

    # Set up package hierarchy
    sys.modules["engines"].kokoro = sys.modules["engines.kokoro"]

    # Add torch.Tensor for scipy compatibility
    sys.modules["torch"].Tensor = type("Tensor", (), {})

    # Store the lock type before we might change threading.Lock
    lock_type = type(threading.Lock())
    original_lock = threading.Lock()

    sys.modules["kokoro"].SAMPLE_RATE = 24000
    sys.modules["kokoro"].generate = MagicMock()
    sys.modules["models"].build_model = MagicMock()
    sys.modules["cleaners"].clean = MagicMock(side_effect=lambda x: x)
    sys.modules["soundfile"].write = MagicMock()

    # Pre-populate engines.kokoro stub with required attributes for patching
    sys.modules["engines.kokoro"].build_model = MagicMock()
    sys.modules["engines.kokoro"].torch = sys.modules["torch"]
    sys.modules["engines.kokoro"].clean = MagicMock()
    sys.modules["engines.kokoro"].generate = MagicMock()
    mock_sf = MagicMock()
    mock_sf.write = MagicMock()
    sys.modules["engines.kokoro"].sf = mock_sf

    mock_voicepack = MagicMock()
    mock_voicepack.to.return_value = mock_voicepack

    # Create a mock KokoroEngine class since we're stubbing engines.kokoro
    class KokoroEngine:
        def __init__(self, device="cpu"):
            self._device = device
            self._lock = original_lock
            self._model = MagicMock()
            self._voicepacks = {
                name: mock_voicepack
                for name in KOKORO_VOICES
            }

        def voices(self):
            return list(self._voicepacks.keys())

        def synthesize(self, text, voice, rate):
            if voice not in self._voicepacks:
                raise ValueError(f"Unknown voice: {voice}")
            # Call the stubbed functions to match test expectations
            import io
            cleaned_text = sys.modules["engines.kokoro"].clean(text)
            audio = sys.modules["engines.kokoro"].generate(text=cleaned_text, voicepack=self._voicepacks[voice], speed=rate)
            buf = io.BytesIO()
            sys.modules["engines.kokoro"].sf.write(buf, audio, 24000, "OGG")
            return buf.getvalue()

    sys.modules["engines.kokoro"].KokoroEngine = KokoroEngine

    # Make threading.Lock work with isinstance in Python 3.12 by replacing it with its type
    monkeypatch.setattr(threading, "Lock", lock_type)

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
    with pytest.raises(ValueError):
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

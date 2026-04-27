from engine import TTSEngine


def test_duck_typed_class_satisfies_protocol():
    class GoodEngine:
        def synthesize(self, text: str, voice: str, rate: float) -> bytes:
            return b""

        def voices(self) -> list[str]:
            return ["v1"]

    assert isinstance(GoodEngine(), TTSEngine)


def test_class_missing_synthesize_fails_protocol():
    class BadEngine:
        def voices(self) -> list[str]:
            return []

    assert not isinstance(BadEngine(), TTSEngine)


def test_class_missing_voices_fails_protocol():
    class BadEngine:
        def synthesize(self, text: str, voice: str, rate: float) -> bytes:
            return b""

    assert not isinstance(BadEngine(), TTSEngine)

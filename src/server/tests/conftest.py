import pytest
from server import EngineRef


class MockEngine:
    def voices(self) -> list[str]:
        return ["af", "af_bella"]

    def synthesize(self, text: str, voice: str, rate: float) -> bytes:
        return b"fake_ogg_audio"


@pytest.fixture
def mock_engine() -> MockEngine:
    return MockEngine()


@pytest.fixture
def engine_ref(mock_engine) -> EngineRef:
    return EngineRef(name="mock", engine=mock_engine, device="cpu")

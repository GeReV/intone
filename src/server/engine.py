from typing import Protocol, runtime_checkable


@runtime_checkable
class TTSEngine(Protocol):
    def synthesize(self, text: str, voice: str, rate: float) -> bytes: ...
    def voices(self) -> list[str]: ...

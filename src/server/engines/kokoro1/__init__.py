from __future__ import annotations
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .engine import Kokoro1Engine

__all__ = ["Kokoro1Engine"]


def __getattr__(name: str) -> object:
    if name == "Kokoro1Engine":
        from .engine import Kokoro1Engine
        return Kokoro1Engine
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")

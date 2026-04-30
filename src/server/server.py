import argparse
import io
import logging
import os
import threading

import gunicorn.app.base
from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

from engine import TTSEngine

_LOGGER = logging.getLogger(__name__)

DEFAULT_VOICE = os.environ.get("SERVER_VOICE", "af")
KNOWN_ENGINES: list[str] = ["kokoro", "kokoro1"]


class EngineRef:
    def __init__(self, name: str, device: str) -> None:
        self.name = name
        self.device = device
        self._current: TTSEngine | None = None
        self._lock = threading.Lock()

    @property
    def current(self) -> TTSEngine:
        if self._current is None:
            with self._lock:
                if self._current is None:
                    self._current = _build_engine(self.name, self.device)
                    _LOGGER.info("Engine %r loaded on %s", self.name, self.device)
        return self._current

    @current.setter
    def current(self, value: TTSEngine) -> None:
        self._current = value

    # Keep swap_lock as an alias so swap_engine route still works
    @property
    def swap_lock(self) -> threading.Lock:
        return self._lock


def create_app(engine_ref: EngineRef) -> Flask:
    app = Flask(__name__)
    CORS(app)

    @app.route("/", methods=["GET"])
    def index():
        return "OK"

    @app.route("/voices", methods=["GET"])
    def get_voices():
        try:
            return jsonify(engine_ref.current.voices())
        except Exception:
            _LOGGER.exception("Failed to list voices")
            return "Failed to list voices", 500

    @app.route("/synthesize", methods=["GET"])
    def synthesize():
        text = request.args.get("text", "").strip()
        if not text:
            return "text parameter is required", 400

        engine = engine_ref.current
        voice = request.args.get("voice", DEFAULT_VOICE)
        if voice not in engine.voices():
            return f"unknown voice: {voice}", 400

        try:
            rate = float(request.args.get("rate", "1.0"))
        except ValueError:
            rate = 1.0
        rate = max(0.5, min(3.0, rate))

        try:
            audio_bytes = engine.synthesize(text, voice, rate)
        except Exception:
            _LOGGER.exception("Synthesis failed")
            return "Synthesis failed", 500

        return send_file(io.BytesIO(audio_bytes), mimetype="audio/ogg")

    @app.route("/engine", methods=["GET"])
    def get_engine():
        with engine_ref.swap_lock:
            name = engine_ref.name
            voices = engine_ref.current.voices()
        return jsonify({"engine": name, "voices": voices})

    @app.route("/engines", methods=["GET"])
    def get_engines():
        return jsonify(KNOWN_ENGINES)

    @app.route("/engine", methods=["POST"])
    def swap_engine():
        name = request.args.get("name", "").strip()
        if not name:
            return "name parameter is required", 400
        with engine_ref.swap_lock:
            try:
                new_engine = _build_engine(name, engine_ref.device)
            except ValueError as e:
                return str(e), 400
            except Exception:
                _LOGGER.exception("Failed to initialize engine %r", name)
                return f"Failed to initialize engine {name!r}", 500
            engine_ref.name = name
            engine_ref.current = new_engine
            confirmed_name = engine_ref.name
            confirmed_voices = new_engine.voices()
        return jsonify({"engine": confirmed_name, "voices": confirmed_voices})

    return app


def _build_engine(name: str, device: str) -> TTSEngine:
    if name == "kokoro":
        from engines.kokoro import KokoroEngine
        return KokoroEngine(device=device)
    if name == "kokoro1":
        from engines.kokoro1 import Kokoro1Engine
        return Kokoro1Engine()
    raise ValueError(f"Unknown engine: {name!r}. Available: {', '.join(KNOWN_ENGINES)}")


class _GunicornApp(gunicorn.app.base.BaseApplication):
    def __init__(self, app: Flask, options: dict) -> None:
        self.options = options
        self.application = app
        super().__init__()

    def load_config(self) -> None:
        for key, value in self.options.items():
            if key in self.cfg.settings and value is not None:
                self.cfg.set(key.lower(), value)

    def load(self) -> Flask:
        return self.application


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=5000)
    parser.add_argument("--engine", default=os.environ.get("SERVER_ENGINE", "kokoro"))
    parser.add_argument(
        "--cuda",
        action="store_true",
        default=os.environ.get("SERVER_CUDA", "").strip() == "1",
    )
    parser.add_argument("--debug", action="store_true")
    args = parser.parse_args()

    logging.basicConfig(level=logging.DEBUG if args.debug else logging.INFO)

    device = "cuda" if args.cuda else "cpu"
    engine_ref = EngineRef(name=args.engine, device=device)

    app = create_app(engine_ref)
    _GunicornApp(app, {
        "bind": f"{args.host}:{args.port}",
        "workers": 1,
        "worker_class": "gthread",
        "threads": 4,
    }).run()


if __name__ == "__main__":
    main()

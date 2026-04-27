import argparse
import io
import logging
import os
from pathlib import Path

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

from engine import TTSEngine

_LOGGER = logging.getLogger(__name__)

CERT_PATH = Path("/certs/cert.pem")
KEY_PATH = Path("/certs/key.pem")

DEFAULT_VOICE = os.environ.get("SERVER_VOICE", "af")


def create_app(engine: TTSEngine) -> Flask:
    app = Flask(__name__)
    CORS(app)

    @app.route("/voices", methods=["GET"])
    def get_voices():
        return jsonify(engine.voices())

    @app.route("/synthesize", methods=["GET"])
    def synthesize():
        text = request.args.get("text", "").strip()
        if not text:
            return "text parameter is required", 400

        voice = request.args.get("voice", DEFAULT_VOICE)
        if voice not in engine.voices():
            return f"unknown voice: {voice}", 400

        try:
            rate = float(request.args.get("rate", "1.0"))
        except ValueError:
            rate = 1.0
        rate = max(0.5, min(2.0, rate))

        try:
            audio_bytes = engine.synthesize(text, voice, rate)
        except Exception:
            _LOGGER.exception("Synthesis failed")
            return "Synthesis failed", 500

        return send_file(io.BytesIO(audio_bytes), mimetype="audio/ogg")

    return app


def _build_engine(name: str, device: str) -> TTSEngine:
    if name == "kokoro":
        from engines.kokoro import KokoroEngine
        return KokoroEngine(device=device)
    raise ValueError(f"Unknown engine: {name!r}. Available: kokoro")


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
    engine = _build_engine(args.engine, device)
    _LOGGER.info("Engine %r loaded on %s", args.engine, device)

    app = create_app(engine)

    ssl_context = None
    if CERT_PATH.exists() and KEY_PATH.exists():
        ssl_context = (str(CERT_PATH), str(KEY_PATH))
        _LOGGER.info("HTTPS enabled (certs at %s)", CERT_PATH.parent)
    else:
        _LOGGER.warning("No certs at /certs — running plain HTTP")

    app.run(host=args.host, port=args.port, ssl_context=ssl_context)


if __name__ == "__main__":
    main()

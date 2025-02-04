#!/usr/bin/env python3
import argparse
import io
import logging
import torch

import soundfile as sf
from flask import Flask, request, send_file

from cleaners import clean
from kokoro import SAMPLE_RATE, generate
from models import build_model

_LOGGER = logging.getLogger()

MODEL_NAME = 'kokoro-v0_19.pth'

def clamp_speed(speed: float | int):
    if not isinstance(speed, float) and not isinstance(speed, int):
        return 1
    elif speed < 0.5:
        return 0.5
    elif speed > 2:
        return 2
    return speed

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--host", default="0.0.0.0", help="HTTP server host")
    parser.add_argument("--port", type=int, default=5000, help="HTTP server port")
    #
    parser.add_argument("-s", "--speaker", type=int, help="Id of speaker (default: 0)")
    #
    parser.add_argument("--cuda", action="store_true", help="Use GPU")
    #
    parser.add_argument(
        "--sentence-silence",
        "--sentence_silence",
        type=float,
        default=0.0,
        help="Seconds of silence after each sentence",
    )
    #
    parser.add_argument(
        "--espeak-data-dir",
        "--espeak_data_dir",
        default="/usr/lib/x86_64-linux-gnu/espeak-ng-data",
        help="Directory containing eSpeak data",
    )
    #
    parser.add_argument(
        "--debug", action="store_true", help="Print DEBUG messages to console"
    )
    args = parser.parse_args()
    logging.basicConfig(level=logging.DEBUG if args.debug else logging.INFO)
    _LOGGER.debug(args)

    device = 'cuda' if torch.cuda.is_available() and args.cuda else 'cpu'

    MODEL = build_model(MODEL_NAME, device)
    _LOGGER.info('Opened model %s', MODEL_NAME)

    VOICE_NAME = [
        'af', # Default voice is a 50-50 mix of Bella & Sarah
        'af_bella', 'af_sarah', 'am_adam', 'am_michael',
        'bf_emma', 'bf_isabella', 'bm_george', 'bm_lewis',
        'af_nicole', 'af_sky',
    ][args.speaker] or VOICE_NAME[0]
    VOICEPACK = torch.load(f'voices/{VOICE_NAME}.pt', weights_only=True).to(device)
    _LOGGER.info("Loaded voice %s", VOICE_NAME)

    # Create web server
    app = Flask(__name__)

    @app.route("/", methods=["GET", "POST"])
    def app_synthesize() -> bytes:
        if request.method == "POST":
            text = request.data.decode("utf-8")
        else:
            text = request.args.get("text", "")

        text = text.strip()
        if not text:
            raise ValueError("No text provided")

        text = clean(text)

        _LOGGER.debug("Synthesizing text: %s", text)

        rate = request.args.get("rate", 1.0)

        audio_io = io.BytesIO()
        audio_data = generate(MODEL, text=text, voicepack=VOICEPACK, lang=VOICE_NAME[0], speed=rate)

        sf.write(audio_io, audio_data, samplerate=SAMPLE_RATE, format='OGG')

        audio_io.seek(0)

        res = send_file(audio_io, mimetype="audio/ogg")
        res.headers["Access-Control-Allow-Origin"] = "*"

        return res

    app.run(host=args.host, port=args.port)


if __name__ == "__main__":
    main()

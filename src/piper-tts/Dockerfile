# syntax=docker/dockerfile:1

ARG BASE=nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04
FROM ${BASE}

RUN apt-get update && apt-get upgrade -y
RUN apt-get install -y --no-install-recommends \
    build-essential git \
    python3 python3-dev python3-pip python3-venv python3-wheel \
    && rm -rf /var/lib/apt/lists/*

# Prevents Python from writing pyc files.
ENV PYTHONDONTWRITEBYTECODE=1

# Keeps Python from buffering stdout and stderr to avoid situations where
# the application crashes without emitting any logs due to buffering.
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN git clone https://github.com/rhasspy/piper.git .

ENV PIPER_VOICE=en_US-ryan-high
ENV PIPER_SPEAKER=0
ENV PIPER_SENTENCE_SILENCE=0.1

WORKDIR /app/src/python_run

RUN script/setup

RUN .venv/bin/pip3 install -r requirements_http.txt && \
    .venv/bin/pip3 install -r requirements_gpu.txt

COPY http_server.py .

CMD .venv/bin/python3 http_server.py \
    --config /config \
    --update-voices \
    --model=${PIPER_VOICE} \
    --speaker ${PIPER_SPEAKER} \
    --sentence-silence ${PIPER_SENTENCE_SILENCE} \
    --cuda
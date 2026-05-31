# syntax=docker/dockerfile:1

ARG UV_VERSION=0.11.16
# CUDA 12.4 + cuDNN 9: required by onnxruntime-gpu 1.26 (CUDA 12 / cuDNN 9 build)
# and matched by the torch cu124 wheels (see pyproject [tool.uv] pytorch-cu124 index).
ARG BASE=nvidia/cuda:12.4.1-cudnn-devel-ubuntu22.04

FROM ghcr.io/astral-sh/uv:${UV_VERSION} AS uv

FROM ${BASE}

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
  --mount=type=cache,target=/var/lib/apt,sharing=locked \
  apt-get update && \
  apt-get install -y --no-install-recommends \
  build-essential git wget unzip curl \
  espeak-ng \
  libsndfile1 \
  openjdk-17-jre-headless \
  python3 python3-dev

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY --from=uv /uv /bin/uv

WORKDIR /app

ARG STANFORD_NER_ZIP=stanford-ner-4.2.0.zip
ENV STANFORD_DIR=/usr/share/java/stanford-ner
ENV CLASSPATH=/usr/share/java/stanford-ner
ENV STANFORD_MODELS=/usr/share/java/stanford-ner/classifiers
RUN --mount=type=cache,target=/root/.cache/stanford-ner \
  if [ ! -f /root/.cache/stanford-ner/$STANFORD_NER_ZIP ]; then \
    wget -O /root/.cache/stanford-ner/$STANFORD_NER_ZIP "https://nlp.stanford.edu/software/$STANFORD_NER_ZIP"; \
  fi && \
  mkdir -p $STANFORD_DIR && \
  cp /root/.cache/stanford-ner/$STANFORD_NER_ZIP $STANFORD_DIR/ && \
  cd $STANFORD_DIR && \
  unzip $STANFORD_NER_ZIP && \
  rm $STANFORD_NER_ZIP && \
  cp -r ./stanford-ner-*/* . && rm -rf ./stanford-ner-*

COPY pyproject.toml uv.lock ./

RUN --mount=type=cache,target=/root/.cache/uv \
  uv sync --frozen --no-dev

RUN --mount=type=cache,target=/root/nltk_data \
  uv run python -m nltk.downloader popular

COPY dictsource/ dictsource/

RUN cd dictsource && espeak-ng --compile=en

COPY . .

CMD ["uv", "run", "python", "server.py"]

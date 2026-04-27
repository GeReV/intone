# syntax=docker/dockerfile:1

ARG BASE=nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04
FROM ${BASE}

RUN apt-get update && \
  apt-get upgrade -y && \
  apt-get install -y --no-install-recommends \
  build-essential git wget unzip curl \
  espeak-ng \
  libsndfile1 \
  openjdk-17-jre-headless \
  python3 python3-dev \
  && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app

ARG STANFORD_NER_ZIP=stanford-ner-4.2.0.zip
ARG STANFORD_DIR=/usr/share/java/stanford-ner
RUN mkdir -p $STANFORD_DIR && \
  cd $STANFORD_DIR && \
  wget "https://nlp.stanford.edu/software/$STANFORD_NER_ZIP" && \
  unzip $STANFORD_NER_ZIP && \
  rm $STANFORD_NER_ZIP && \
  cp -r ./stanford-ner-*/* . && rm -rf ./stanford-ner-*

ENV CLASSPATH=$STANFORD_DIR
ENV STANFORD_MODELS="$STANFORD_DIR/classifiers"

COPY pyproject.toml uv.lock ./

RUN uv sync --frozen --no-dev \
  --extra-index-url https://download.pytorch.org/whl/cu118

RUN uv run python -m nltk.downloader popular

COPY . .

RUN cd dictsource && espeak-ng --compile=en

CMD ["uv", "run", "python", "server.py"]

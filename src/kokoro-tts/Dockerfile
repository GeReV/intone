# syntax=docker/dockerfile:1

ARG BASE=nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04
FROM ${BASE}

RUN apt-get update &&  \
  apt-get upgrade -y && \
  apt-get install -y --no-install-recommends \
  build-essential git wget unzip \
  espeak-ng \
  openjdk-17-jre-headless \
  python3 python3-dev python3-pip python3-venv python3-wheel \
  && rm -rf /var/lib/apt/lists/*

# Prevents Python from writing pyc files.
ENV PYTHONDONTWRITEBYTECODE=1

# Keeps Python from buffering stdout and stderr to avoid situations where
# the application crashes without emitting any logs due to buffering.
ENV PYTHONUNBUFFERED=1

WORKDIR /app

ENV KOKORO_SPEAKER=0

COPY requirements.txt .

RUN python3 -m venv .venv

# Packages for Kokoro server
RUN .venv/bin/pip3 install -r requirements.txt

# Packages for NER cleaner
RUN .venv/bin/pip3 install nltk inflect num2words &&  \
  .venv/bin/python3 -m nltk.downloader popular

ARG STANFORD_NER_ZIP=stanford-ner-4.2.0.zip
ARG STANFORD_DIR=/usr/share/java/stanford-ner
RUN mkdir -p $STANFORD_DIR && \
  cd $STANFORD_DIR && \
  wget "https://nlp.stanford.edu/software/$STANFORD_NER_ZIP" &&  \
  unzip $STANFORD_NER_ZIP &&  \
  rm $STANFORD_NER_ZIP && \
  cp -r ./stanford-ner-*/* . && rm -rf ./stanford-ner-*

ENV CLASSPATH=$STANFORD_DIR
ENV STANFORD_MODELS="$STANFORD_DIR/classifiers"

COPY . .

RUN cd dictsource && espeak-ng --compile=en

CMD .venv/bin/python3 http_server.py \
  --speaker ${KOKORO_SPEAKER} \
  --cuda

FROM ghcr.io/coqui-ai/tts

ARG MODEL_NAME
ENV MODEL_NAME=${MODEL_NAME:-tts_models/en/vctk/vits}

WORKDIR /root
COPY server.py /root/TTS/server

EXPOSE 5002

#ENTRYPOINT ["/bin/bash"]
ENTRYPOINT ["python3", "/root/TTS/server/server.py"]
CMD ["--model_name", "tts_models/multilingual/multi-dataset/bark", "--use_cuda", "True", "--show_details", "True"]
FROM ghcr.io/coqui-ai/tts

WORKDIR /root
COPY ./src/tts /root/TTS/server

EXPOSE 5002

ENTRYPOINT ["python3", "/root/TTS/server/server.py"]
CMD ["--model_name", "tts_models/en/vctk/vits", "--use_cuda", "True", "--show_details", "True"]
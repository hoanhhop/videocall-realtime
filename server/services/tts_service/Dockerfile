FROM python:3.11-slim AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential gcc ffmpeg libsndfile1 espeak-ng \
    && rm -rf /var/lib/apt/lists/*

# Cài torch, torchaudio, torchvision bản phù hợp CUDA (ví dụ CUDA 12.1)
RUN pip install --upgrade pip
RUN pip install torch==2.2.0+cu121 torchaudio==2.2.0+cu121 torchvision==0.17.0+cu121 --index-url https://download.pytorch.org/whl/cu121

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Stage 2: Runtime image
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ffmpeg libsndfile1 espeak-ng \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

RUN mkdir -p /app/models /root/.cache/huggingface /root/.cache/torch
ENV HF_HOME=/root/.cache/huggingface

COPY run_tts.py .
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

ENV OMP_NUM_THREADS=4
ENV CUDA_VISIBLE_DEVICES=0
ENV PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512

ENV MODEL_PATH=/app/models/XTTS-v2
ENV USE_CUDA=true
ENV SAMPLE_RATE=24000
ENV SPEAKER_WAV_PATH=/app/models/speakers
ENV USE_ONNX=true
ENV ONNX_MODEL_PATH=/app/models/XTTS-v2/onnx

EXPOSE 5002

CMD ["/bin/bash", "entrypoint.sh"]
# Multi-stage build cho Translation Service
FROM python:3.10-slim-bullseye AS builder

# Cài đặt các công cụ build (với --no-install-recommends để giảm kích thước)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Thiết lập thư mục làm việc
WORKDIR /build

# Cài đặt các gói phụ thuộc Python
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Runtime image
FROM python:3.10-slim-bullseye

# Thiết lập thư mục làm việc
WORKDIR /app

# Copy thư viện Python đã cài đặt từ builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Tạo thư mục cho model và cache với chính xác hơn
RUN mkdir -p /app/models /root/.cache/huggingface /root/.cache/ctranslate2
ENV HF_HOME=/root/.cache/huggingface
ENV CT2_CACHE_DIR=/root/.cache/ctranslate2

# Copy các file cần thiết
COPY run_translation.py .
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Thiết lập biến môi trường (optimized)
ENV OMP_NUM_THREADS=4
ENV PORT_TRANSLATION=50052
ENV OPUS_MODELS_BASE_PATH=/app/models/opus_mt
ENV BATCH_SIZE=16
ENV NUM_WORKERS=4
ENV USE_CUDA=true
ENV MAX_QUEUE_SIZE=32
ENV CPU_THREADS=8

# Mở cổng mà dịch vụ sẽ lắng nghe
EXPOSE 50052

# Chạy script khởi động
CMD ["/bin/bash", "entrypoint.sh"] 
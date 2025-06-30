# Sử dụng multi-stage build để giảm kích thước image
FROM python:3.10-slim as builder

# Cài đặt các gói phụ thuộc build
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    libavformat-dev \
    libavcodec-dev \
    libavdevice-dev \
    libavutil-dev \
    libswscale-dev \
    libswresample-dev \
    libavfilter-dev \
    && rm -rf /var/lib/apt/lists/*

# Thiết lập thư mục làm việc
WORKDIR /build

# Cài đặt các gói phụ thuộc Python trong một layer
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip setuptools wheel && \
    pip install --no-cache-dir --user -r requirements.txt

# Stage 2: Runtime image
FROM python:3.10-slim

# Cài đặt runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Thiết lập thư mục làm việc
WORKDIR /app

# Copy thư viện Python đã cài đặt từ builder
COPY --from=builder /root/.local /root/.local
ENV PATH=/root/.local/bin:$PATH

# Copy script chạy dịch vụ
COPY run_phowhisper.py .
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Tạo thư mục cho model cache
RUN mkdir -p /root/.cache/huggingface /root/.cache/ctranslate2
ENV HF_HOME=/root/.cache/huggingface
ENV CT2_CACHE_DIR=/root/.cache/ctranslate2

# Thiết lập các biến môi trường tối ưu theo khuyến nghị
ENV OMP_NUM_THREADS=4
ENV PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
ENV CUDA_VISIBLE_DEVICES=0
ENV USE_CUDA=true
ENV COMPUTE_TYPE=float16
ENV BEAM_SIZE=1         
ENV VAD_FILTER=true     
ENV CHUNK_LENGTH=0.4    
ENV LOW_MEMORY=true     

# Mở cổng mà dịch vụ sẽ lắng nghe bên trong container
EXPOSE 50051

# Chạy script khởi động thay vì chạy trực tiếp Python
CMD ["/bin/bash", "entrypoint.sh"]

# Lưu ý: Hiện tại sử dụng PhoWhisper-medium-ct2, yêu cầu nhiều RAM hơn
# Có thể cần điều chỉnh cấu hình RAM trong Docker nếu gặp vấn đề về bộ nhớ

# Lưu ý về AMD ROCm:
# Hỗ trợ AMD ROCm cho faster-whisper (thông qua CTranslate2) phức tạp hơn và thường yêu cầu
# base image có sẵn ROCm (ví dụ: rocm/pytorch) và build CTranslate2 từ source với ROCm support.
# Dockerfile này hiện tại tập trung vào CPU và NVIDIA CUDA. 

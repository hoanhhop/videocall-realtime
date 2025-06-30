# Sử dụng base image Python
FROM python:3.10-slim

# Thiết lập thư mục làm việc
WORKDIR /app

# Cài đặt các gói phụ thuộc hệ thống
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt các gói phụ thuộc Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy script chạy dịch vụ
COPY run_embeddings.py .

# Model sẽ được tự động tải khi cần
RUN mkdir -p /app/data

# Mặc định chạy trên cổng 5003
EXPOSE 5003

# Biến môi trường
ENV EMBEDDING_MODEL=all-MiniLM-L6-v2
ENV ENABLE_CACHE=true
ENV CACHE_DIR=/app/data

# Chạy dịch vụ
CMD ["python", "run_embeddings.py"] 
# Sử dụng base image Python
FROM python:3.10-slim

# Thiết lập thư mục làm việc
WORKDIR /app

# Cài đặt các gói phụ thuộc hệ thống
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt các gói phụ thuộc Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy script chạy dịch vụ
COPY run_phowhisper.py .

# Script khởi động dịch vụ
COPY entrypoint.sh .
RUN chmod +x entrypoint.sh

# Mặc định chạy trên cổng 5000
EXPOSE 5000

# Chạy script khởi động thay vì chạy trực tiếp Python
CMD ["/bin/bash", "entrypoint.sh"]

# Lưu ý về AMD ROCm:
# Hỗ trợ AMD ROCm cho faster-whisper (thông qua CTranslate2) phức tạp hơn và thường yêu cầu
# base image có sẵn ROCm (ví dụ: rocm/pytorch) và build CTranslate2 từ source với ROCm support.
# Dockerfile này hiện tại tập trung vào CPU và NVIDIA CUDA. 
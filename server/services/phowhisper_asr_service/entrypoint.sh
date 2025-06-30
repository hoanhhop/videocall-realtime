#!/bin/bash
set -e

# Đặt biến môi trường, ưu tiên từ docker-compose
MODEL_PATH=${MODEL_PATH_CT2:-/app/models/phowhisper/PhoWhisper-medium-ct2}
SERVICE_PORT=${PORT_ASR:-50051}
USE_CUDA=${USE_CUDA:-true}
COMPUTE_TYPE=${COMPUTE_TYPE:-float16}
BEAM_SIZE=${BEAM_SIZE:-1}
VAD_FILTER=${VAD_FILTER:-true}
CHUNK_LENGTH=${CHUNK_LENGTH:-0.4}
LOW_MEMORY=${LOW_MEMORY:-true}
MAX_WORKERS=${MAX_WORKERS:-2}

echo "=== Khởi động dịch vụ PhoWhisper ASR với cấu hình tối ưu ==="
echo "Mô hình: $MODEL_PATH"
echo "Cổng: $SERVICE_PORT"
echo "Sử dụng CUDA: $USE_CUDA"
echo "Compute Type: $COMPUTE_TYPE"
echo "Beam Size: $BEAM_SIZE"
echo "VAD Filter: $VAD_FILTER"
echo "Chunk Length: $CHUNK_LENGTH"
echo "Low Memory Mode: $LOW_MEMORY"
echo "Worker Threads: $MAX_WORKERS"

# Kiểm tra mô hình
if [ -f "$MODEL_PATH/model.bin" ]; then
    echo "✅ Mô hình PhoWhisper CTranslate2 đã được tìm thấy"
else
    echo "❌ Không tìm thấy mô hình tại $MODEL_PATH/model.bin"
    echo "Vui lòng đảm bảo mô hình đã được cài đặt đúng."
    exit 1
fi

# Thiết lập các biến môi trường tối ưu
export MODEL_PATH="$MODEL_PATH"
export PORT="$SERVICE_PORT"
export USE_CUDA="$USE_CUDA"
export COMPUTE_TYPE="$COMPUTE_TYPE"
export BEAM_SIZE="$BEAM_SIZE"
export VAD_FILTER="$VAD_FILTER"
export CHUNK_LENGTH="$CHUNK_LENGTH"
export LOW_MEMORY="$LOW_MEMORY"
export MAX_WORKERS="$MAX_WORKERS"
export OMP_NUM_THREADS=4
export PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512

# Khởi động dịch vụ
echo "🚀 Khởi động dịch vụ PhoWhisper trên cổng $SERVICE_PORT..."
python run_phowhisper.py 
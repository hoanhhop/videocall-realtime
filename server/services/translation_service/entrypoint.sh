#!/bin/bash
set -e

# Đặt biến môi trường với các giá trị tối ưu theo hướng dẫn
OPUS_MODELS_BASE_PATH=${OPUS_MODELS_BASE_PATH:-/app/models/opus_mt}
MAX_LENGTH=${MAX_LENGTH:-512}
SERVICE_PORT=${PORT_TRANSLATION:-50052}
USE_CUDA=${USE_CUDA:-true}
BATCH_SIZE=${BATCH_SIZE:-16}
NUM_WORKERS=${NUM_WORKERS:-4}
CPU_THREADS=${CPU_THREADS:-8}
MAX_QUEUE_SIZE=${MAX_QUEUE_SIZE:-32}

echo "=== Khởi động dịch vụ dịch thuật OPUS-MT với cấu hình tối ưu ==="
echo "Thư mục mô hình: $OPUS_MODELS_BASE_PATH"
echo "Cổng dịch vụ: $SERVICE_PORT"
echo "Sử dụng GPU: $USE_CUDA"
echo "Kích thước batch: $BATCH_SIZE"
echo "Số worker: $NUM_WORKERS"
echo "Số thread CPU: $CPU_THREADS"
echo "Kích thước hàng đợi: $MAX_QUEUE_SIZE"

# Kiểm tra xem thư mục có tồn tại không
if [ ! -d "$OPUS_MODELS_BASE_PATH" ]; then
    echo "❌ Không tìm thấy thư mục mô hình tại $OPUS_MODELS_BASE_PATH"
    echo "Vui lòng đảm bảo đã mount thư mục chứa các mô hình OPUS-MT"
    exit 1
fi

# Kiểm tra xem các thư mục mô hình con có tồn tại không
MODEL_VI_EN="$OPUS_MODELS_BASE_PATH/vi_en_model-ct2"
MODEL_EN_VI="$OPUS_MODELS_BASE_PATH/en_vi_model-ct2"

MODEL_COUNT=0

if [ -d "$MODEL_VI_EN" ]; then
    echo "✅ Tìm thấy mô hình Việt-Anh tại $MODEL_VI_EN"
    MODEL_COUNT=$((MODEL_COUNT+1))
else
    echo "⚠️ Không tìm thấy mô hình Việt-Anh tại $MODEL_VI_EN"
    echo "Bạn có thể tải mô hình từ: Helsinki-NLP/opus-mt-vi-en"
fi

if [ -d "$MODEL_EN_VI" ]; then
    echo "✅ Tìm thấy mô hình Anh-Việt tại $MODEL_EN_VI"
    MODEL_COUNT=$((MODEL_COUNT+1))
else
    echo "⚠️ Không tìm thấy mô hình Anh-Việt tại $MODEL_EN_VI"
    echo "Bạn có thể tải mô hình từ: Helsinki-NLP/opus-mt-en-vi"
fi

if [ $MODEL_COUNT -eq 0 ]; then
    echo "❌ Không tìm thấy mô hình OPUS-MT nào. Không thể tiếp tục."
    exit 1
fi

# Kiểm tra GPU
if [ "$USE_CUDA" = "true" ]; then
    if python -c "import torch; print(torch.cuda.is_available());" | grep -q "True"; then
        echo "🚀 Phát hiện GPU, sẽ sử dụng GPU để dịch thuật"
        export USE_CUDA=true
        GPU_INFO=$(python -c "import torch; print(torch.cuda.get_device_name(0))")
        echo "🎮 GPU phát hiện: $GPU_INFO"
        
        # Kiểm tra VRAM
        if command -v nvidia-smi &> /dev/null; then
            VRAM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | awk '{print $1}')
            echo "💾 VRAM: $VRAM MB"
        fi
    else
        echo "⚠️ GPU không khả dụng hoặc PyTorch không được cài đặt với hỗ trợ CUDA"
        echo "🖥️ Sẽ sử dụng CPU thay thế"
        export USE_CUDA=false
    fi
else
    echo "🖥️ Sử dụng CPU theo chỉ định"
    export USE_CUDA=false
fi

# Thiết lập các biến môi trường tối ưu
export OPUS_MODELS_BASE_PATH="$OPUS_MODELS_BASE_PATH"
export PORT="$SERVICE_PORT"
export USE_CUDA="$USE_CUDA"
export BATCH_SIZE="$BATCH_SIZE"
export NUM_WORKERS="$NUM_WORKERS"
export CPU_THREADS="$CPU_THREADS"
export MAX_QUEUE_SIZE="$MAX_QUEUE_SIZE"
export MAX_LENGTH="$MAX_LENGTH"
export OMP_NUM_THREADS=$CPU_THREADS

# Chạy dịch vụ
echo "🚀 Khởi động dịch vụ dịch thuật trên cổng $SERVICE_PORT..."
python run_translation.py 

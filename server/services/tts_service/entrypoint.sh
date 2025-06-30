#!/bin/bash
set -e

# Đặt biến môi trường với các tham số tối ưu
MODEL_PATH=${MODEL_PATH:-/app/models/XTTS-v2}
ONNX_PATH=${ONNX_MODEL_PATH:-/app/models/XTTS-v2/onnx}
SPEAKER_PATH=${SPEAKER_WAV_PATH:-/app/models/speakers}
USE_CUDA=${USE_CUDA:-true}
USE_ONNX=${USE_ONNX:-true}
BATCH_SIZE=${BATCH_SIZE:-2}
SAMPLE_RATE=${SAMPLE_RATE:-24000}
CHUNK_SIZE=${CHUNK_SIZE:-150}
MAX_WORKERS=${MAX_WORKERS:-2}
SERVICE_PORT=${PORT:-5002}

echo "=== Khởi động dịch vụ TTS với cấu hình tối ưu ==="
echo "Mô hình TTS: $MODEL_PATH"
echo "Mô hình ONNX: $ONNX_PATH (Sử dụng: $USE_ONNX)"
echo "Thư mục speaker: $SPEAKER_PATH"
echo "Sử dụng GPU: $USE_CUDA"
echo "Cổng dịch vụ: $SERVICE_PORT"
echo "Kích thước batch: $BATCH_SIZE"
echo "Sample rate: $SAMPLE_RATE"
echo "Kích thước đoạn: $CHUNK_SIZE"
echo "Số worker: $MAX_WORKERS"

# Kiểm tra xem mô hình có tồn tại không
if [ ! -d "$MODEL_PATH" ]; then
    echo "❌ Không tìm thấy thư mục mô hình tại $MODEL_PATH"
    echo "Tự động tải mô hình XTTS-v2..."
    
    # Tạo thư mục nếu chưa tồn tại
    mkdir -p "$MODEL_PATH"
    
    # Tải mô hình từ HuggingFace
    python -c "from TTS.utils.manage import ModelManager; ModelManager().download_model('tts_models/multilingual/multi-dataset/xtts_v2')"
    
    # Kiểm tra kết quả
    if [ $? -ne 0 ]; then
        echo "❌ Tải mô hình thất bại!"
        exit 1
    else
        echo "✅ Tải mô hình thành công!"
    fi
else
    echo "✅ Thư mục mô hình đã tồn tại."
fi

# Tạo thư mục speaker nếu chưa tồn tại
if [ ! -d "$SPEAKER_PATH" ]; then
    echo "Tạo thư mục speaker..."
    mkdir -p "$SPEAKER_PATH"
fi

# Kiểm tra xem có ít nhất một file speaker mẫu không
SPEAKER_COUNT=$(find "$SPEAKER_PATH" -name "*.wav" | wc -l)
if [ $SPEAKER_COUNT -eq 0 ]; then
    echo "Cảnh báo: Không tìm thấy file speaker mẫu trong $SPEAKER_PATH"
    echo "Tạo file speaker mẫu..."
    
    # Tạo giọng nói mẫu sử dụng espeak (espeak-ng đã được cài trong Dockerfile)
    espeak-ng -v vi -w "$SPEAKER_PATH/vi_female.wav" "Xin chào, đây là giọng nói mẫu tiếng Việt."
    espeak-ng -v en -w "$SPEAKER_PATH/en_male.wav" "Hello, this is a sample English voice."
fi

# Cài đặt thông số tối ưu
if [ "$USE_CUDA" = "true" ]; then
    echo "🚀 Sử dụng CUDA cho TTS"
    export CUDA_VISIBLE_DEVICES=0
    export PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
else
    echo "🚀 Sử dụng CPU cho TTS"
    export CUDA_VISIBLE_DEVICES=""
fi

# Thiết lập các biến môi trường tối ưu
export MODEL_PATH="$MODEL_PATH"
export ONNX_MODEL_PATH="$ONNX_PATH"
export SPEAKER_WAV_PATH="$SPEAKER_PATH"
export PORT="$SERVICE_PORT"
export USE_CUDA="$USE_CUDA"
export USE_ONNX="$USE_ONNX"
export BATCH_SIZE="$BATCH_SIZE"
export SAMPLE_RATE="$SAMPLE_RATE"
export CHUNK_SIZE="$CHUNK_SIZE"
export MAX_WORKERS="$MAX_WORKERS"
export OMP_NUM_THREADS=4

# Chạy dịch vụ TTS
echo "🚀 Khởi động dịch vụ TTS trên cổng $SERVICE_PORT..."
python run_tts.py 
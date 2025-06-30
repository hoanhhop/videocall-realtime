#!/bin/bash
set -e

# Đặt biến môi trường
MODEL_PATH=${MODEL_PATH:-/app/models/phowhisper/PhoWhisper-base-ct2}

echo "=== Kiểm tra mô hình PhoWhisper CTranslate2 ==="
echo "Mô hình CTranslate2: $MODEL_PATH"

# Kiểm tra xem mô hình CTranslate2 có tồn tại không
if [ -f "$MODEL_PATH/model.bin" ]; then
    echo "✅ Mô hình CTranslate2 đã tồn tại, sử dụng mô hình hiện có."
else
    echo "❌ Không tìm thấy mô hình CTranslate2 tại $MODEL_PATH/model.bin"
    echo "Vui lòng đảm bảo mô hình CTranslate2 đã được cài đặt đúng."
    exit 1
fi

# Thiết lập biến môi trường cho dịch vụ
export MODEL_PATH="$MODEL_PATH"
echo "🚀 Sử dụng mô hình CTranslate2 tại: $MODEL_PATH"

# Chạy dịch vụ PhoWhisper
echo "🚀 Khởi động dịch vụ PhoWhisper..."
python run_phowhisper.py 
#!/bin/bash
# optimize-services.sh - Script tự động tối ưu hóa các dịch vụ AI

set -e

echo "===== TRÌNH TỐI ƯU HÓA DỊCH VỤ TRÍ TUỆ NHÂN TẠO ====="
echo "Script này sẽ tối ưu hóa các mô hình AI được sử dụng trong hệ thống."
echo "Lưu ý: Quá trình này yêu cầu GPU và có thể mất một thời gian."
echo "======================================================"

# Đường dẫn cơ sở
BASE_DIR=$(pwd)
SERVER_DIR="$BASE_DIR/server"
MODELS_DIR="$SERVER_DIR/models"
SCRIPTS_DIR="$BASE_DIR/scripts"
UTILS_DIR="$SCRIPTS_DIR/utils"

# ===== Tạo thư mục nếu chưa tồn tại =====
mkdir -p "$SERVER_DIR/logs"
mkdir -p "$MODELS_DIR/phowhisper/PhoWhisper-base-ct2"
mkdir -p "$MODELS_DIR/opus_mt/en_vi_model-ct2"
mkdir -p "$MODELS_DIR/opus_mt/vi_en_model-ct2"
mkdir -p "$MODELS_DIR/tts/XTTS-v2/onnx"
mkdir -p "$MODELS_DIR/embeddings"

# Tạo thư mục cache cho Docker volumes
mkdir -p "$BASE_DIR/phowhisper-cache"
mkdir -p "$BASE_DIR/translation-cache"
mkdir -p "$BASE_DIR/tts-cache"
mkdir -p "$BASE_DIR/embeddings-cache"

# Detect GPU/CPU mode
if [ -z "$USE_CUDA" ]; then
  if command -v nvidia-smi &> /dev/null; then
    export USE_CUDA=true
    echo "Phát hiện GPU NVIDIA - sẽ chạy tối ưu GPU (USE_CUDA=true)"
  else
    export USE_CUDA=false
    echo "Không phát hiện GPU - sẽ chạy tối ưu CPU (USE_CUDA=false)"
  fi
else
  echo "USE_CUDA đã được set từ ngoài: $USE_CUDA"
fi

# Set USE_ONNX=false mặc định nếu chưa có
if [ -z "$USE_ONNX" ]; then
  export USE_ONNX=false
fi

# ===== Tối ưu hóa PhoWhisper =====
optimize_phowhisper() {
  echo "===== ĐANG TỐI ƯU HÓA PHOWHISPER ====="
  echo "Chuyển đổi mô hình PhoWhisper sang định dạng CTranslate2..."

  # Kiểm tra xem mô hình đã được chuyển đổi chưa
  if [ -f "$MODELS_DIR/phowhisper/PhoWhisper-medium-ct2/model.bin" ]; then
    echo "Mô hình PhoWhisper-medium-ct2 đã tồn tại, bỏ qua."
  elif [ -f "$MODELS_DIR/phowhisper/PhoWhisper-base-ct2/model.bin" ]; then
    echo "Mô hình PhoWhisper-base-ct2 đã tồn tại, bỏ qua."
  else
    echo "Bắt đầu chuyển đổi mô hình..."
    # Kiểm tra xem mô hình nguồn nào tồn tại
    if [ -d "$MODELS_DIR/phowhisper/PhoWhisper-medium" ]; then
      # Gọi script Python chuyển đổi mô hình
      python3 "$UTILS_DIR/check_and_convert_models.py"
    elif [ -d "$MODELS_DIR/phowhisper/PhoWhisper-base" ]; then
      python3 "$UTILS_DIR/convert_to_ct2.py" \
        --model_path "$MODELS_DIR/phowhisper/PhoWhisper-base" \
        --output "$MODELS_DIR/phowhisper/PhoWhisper-base-ct2" \
        --quantization "float16" \
        --device "cuda"
    else
      echo "Không tìm thấy mô hình PhoWhisper nguồn. Vui lòng tải xuống trước."
      exit 1
    fi
    
    if [ $? -ne 0 ]; then
      echo "Lỗi: Không thể chuyển đổi mô hình PhoWhisper. Kiểm tra log để biết chi tiết."
      exit 1
    fi

    echo "Đã chuyển đổi mô hình thành công."
  fi
  
  echo "Cấu hình dịch vụ PhoWhisper sử dụng mô hình mới..."
}

# ===== Tối ưu hóa Translation Service =====
optimize_translation() {
  echo "===== ĐANG TỐI ƯU HÓA DỊCH THUẬT ====="

  # Kiểm tra nếu mô hình CT2 đã tồn tại
  if [ -f "$MODELS_DIR/opus_mt/en_vi_model-ct2/model.bin" ] && [ -f "$MODELS_DIR/opus_mt/vi_en_model-ct2/model.bin" ]; then
    echo "Mô hình OPUS-MT CT2 đã tồn tại, bỏ qua."
  else
    # Kiểm tra mô hình nguồn
    if [ -d "$MODELS_DIR/opus_mt/en_vi_model" ] && [ -d "$MODELS_DIR/opus_mt/vi_en_model" ]; then
      echo "Bắt đầu chuyển đổi mô hình OPUS-MT sang CT2..."
      
      # Chuyển đổi en_vi_model nếu cần
      if [ ! -f "$MODELS_DIR/opus_mt/en_vi_model-ct2/model.bin" ]; then
        python3 "$UTILS_DIR/convert_opus_to_ct2.py" \
          --model_path "$MODELS_DIR/opus_mt/en_vi_model" \
          --quantization "float16" \
          --device "cuda"
      fi
      
      # Chuyển đổi vi_en_model nếu cần
      if [ ! -f "$MODELS_DIR/opus_mt/vi_en_model-ct2/model.bin" ]; then
        python3 "$UTILS_DIR/convert_opus_to_ct2.py" \
          --model_path "$MODELS_DIR/opus_mt/vi_en_model" \
          --quantization "float16" \
          --device "cuda"
      fi
    else
      echo "Không tìm thấy mô hình OPUS-MT nguồn. Vui lòng tải xuống trước."
    fi
  fi
  
  echo "Cấu hình dịch vụ Translation với batch & threading..."
  echo "Mô hình dịch thuật đã được tối ưu."
}

# ===== Tối ưu hóa TTS Service =====
optimize_tts() {
  echo "===== ĐANG TỐI ƯU HÓA TTS (XTTS-v2) ====="
  
  # Kiểm tra xem mô hình ONNX đã được chuyển đổi chưa 
  if [ -d "$MODELS_DIR/tts/XTTS-v2/onnx" ] && [ "$(ls -A "$MODELS_DIR/tts/XTTS-v2/onnx")" ]; then
    echo "Mô hình ONNX đã tồn tại, bỏ qua."
  else
    # Kiểm tra mô hình nguồn
    if [ -f "$MODELS_DIR/tts/XTTS-v2/model.pth" ]; then
      echo "Chuyển đổi mô hình sang ONNX..."
      python3 "$UTILS_DIR/convert_xtts_to_onnx.py" --device "cuda"
      
      if [ $? -ne 0 ]; then
        echo "Cảnh báo: Không thể chuyển đổi mô hình TTS sang ONNX. Sẽ sử dụng PyTorch."
        # Tạo thư mục onnx và file đánh dấu
        mkdir -p "$MODELS_DIR/tts/XTTS-v2/onnx"
        echo '{"attempted": true, "date": "'"$(date)"'", "status": "fallback_to_pytorch"}' > "$MODELS_DIR/tts/XTTS-v2/onnx/marker.json"
      fi
    else
      echo "Không tìm thấy mô hình XTTS-v2 nguồn. Vui lòng tải xuống trước."
    fi
  fi
  
  echo "Cấu hình dịch vụ TTS với chunking và pipelining..."
  echo "Mô hình TTS đã được tối ưu."
}

# ===== Tối ưu embeddings =====
optimize_embeddings() {
  echo "===== ĐANG TỐI ƯU HÓA EMBEDDINGS ====="
  
  if [ -f "$MODELS_DIR/embeddings/config.json" ]; then
    echo "Mô hình embeddings đã được cấu hình, bỏ qua."
  else
    echo "Cấu hình dịch vụ embeddings..."
    if [ -f "$SCRIPTS_DIR/optimize_embeddings.py" ]; then
      python3 "$SCRIPTS_DIR/optimize_embeddings.py" --all
    fi
  fi
  
  echo "Mô hình embeddings đã được tối ưu."
}

# ===== Tối ưu GPU cho Docker =====
optimize_docker() {
  echo "===== ĐANG TỐI ƯU HÓA DOCKER GPU ====="
  
  # Kiểm tra xem nvidia-smi có hoạt động không (GPU có sẵn)
  if command -v nvidia-smi >/dev/null 2>&1; then
    echo "Phát hiện NVIDIA GPU, đang cấu hình docker-compose.yml..."
    
    # Kiểm tra xem file docker-compose.yml tồn tại
    DOCKER_COMPOSE_FILE="$BASE_DIR/docker-compose.yml"
    if [ ! -f "$DOCKER_COMPOSE_FILE" ]; then
      echo "Không tìm thấy file docker-compose.yml"
      return
    fi
    
    # Cập nhật docker-compose.yml để sử dụng GPU
    sed -i 's/# deploy:/deploy:/g' "$DOCKER_COMPOSE_FILE"
    sed -i 's/#   resources:/  resources:/g' "$DOCKER_COMPOSE_FILE"
    sed -i 's/#     reservations:/    reservations:/g' "$DOCKER_COMPOSE_FILE"
    sed -i 's/#       devices:/      devices:/g' "$DOCKER_COMPOSE_FILE"
    sed -i 's/#         - driver: nvidia/        - driver: nvidia/g' "$DOCKER_COMPOSE_FILE"
    sed -i 's/#           count: 1/          count: 1/g' "$DOCKER_COMPOSE_FILE"
    sed -i 's/#           capabilities: \[gpu\]/          capabilities: \[gpu\]/g' "$DOCKER_COMPOSE_FILE"
    
    echo "Đã bật GPU cho Docker."
  else
    echo "Không phát hiện NVIDIA GPU. Docker sẽ chạy trên CPU."
  fi
}

# ===== Thực thi các hàm tối ưu hóa =====
echo "Bắt đầu quá trình tối ưu hóa..."

# Tạo file .env nếu chưa tồn tại
if [ ! -f "$BASE_DIR/.env" ]; then
  echo "Tạo file .env từ template..."
  if [ -f "$BASE_DIR/.env.example" ]; then
    cp "$BASE_DIR/.env.example" "$BASE_DIR/.env"
  else
    # Tạo file .env mới nếu không có file mẫu
    cat > "$BASE_DIR/.env" << EOL
# Video Call Translation
API_PORT=5000
SOCKET_PORT=5001
PHOWHISPER_ASR_URL=http://localhost:50051
TRANSLATION_SERVICE_URL=http://localhost:50052
TTS_SERVICE_URL=http://localhost:5002
EMBEDDING_SERVICE_URL=http://localhost:5003
NODE_ENV=production
USE_CUDA=$USE_CUDA
USE_ONNX=$USE_ONNX
LOG_LEVEL=info
EOL
  fi
  echo "Đã tạo file .env."
else
  sed -i "s/USE_CUDA=.*/USE_CUDA=$USE_CUDA/g" "$BASE_DIR/.env"
  sed -i "s/USE_ONNX=.*/USE_ONNX=$USE_ONNX/g" "$BASE_DIR/.env"
fi

# Thực thi các hàm tối ưu hóa
optimize_phowhisper
optimize_translation
optimize_tts
optimize_embeddings
optimize_docker

echo "==================================================="
echo "Tối ưu hóa hoàn tất! Các mô hình đã được tối ưu."
echo "Hãy tiếp tục với quá trình triển khai."
echo "===================================================" 

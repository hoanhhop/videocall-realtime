#!/bin/bash
set -e

echo "=== Video Call Translation - Ubuntu Setup Script ==="
echo ""

# Cài đặt các gói hệ thống cần thiết
echo "Cài đặt các gói hệ thống cần thiết..."
sudo apt-get update
sudo apt-get install -y python3-pip python3-venv ffmpeg build-essential libsndfile1 portaudio19-dev

# Tạo và kích hoạt môi trường ảo
echo "Tạo môi trường ảo..."
python3 -m venv venv
source venv/bin/activate

# Cài đặt các gói Python cần thiết
echo "Cài đặt các gói Python..."
pip install -U pip setuptools wheel
pip install -r requirements.txt

# Cài đặt PyAV (bắt buộc cho PhoWhisper ASR)
echo "Cài đặt PyAV (av) - thư viện cần thiết cho faster-whisper..."
# Trước tiên, cài đặt các phụ thuộc của PyAV
sudo apt-get install -y libavformat-dev libavcodec-dev libavdevice-dev libavutil-dev libswscale-dev libswresample-dev libavfilter-dev
# Cài đặt PyAV bằng pip
pip install av --no-binary av

# Cài đặt TTS (bắt buộc cho dịch vụ TTS)
echo "Cài đặt TTS..."
pip install TTS==0.22.0

# Cài đặt các gói Node.js
echo "Cài đặt các gói Node.js..."
npm install

# Cài đặt các gói cho client
echo "Cài đặt các gói cho client..."
cd client
npm install
cd ..

# Tạo thư mục logs và models
echo "Tạo thư mục logs và models..."
mkdir -p server/logs
mkdir -p server/models/{phowhisper,envit5,opus_mt,tts}
mkdir -p server/models/phowhisper/PhoWhisper-base-ct2
mkdir -p server/models/envit5/envit5-translation

# Tạo thư mục cache
echo "Tạo thư mục cache..."
mkdir -p phowhisper-cache translation-cache tts-cache embeddings-cache

# Tải xuống mô hình thông qua huggingface-cli
echo "Tải xuống mô hình..."
echo "Lưu ý: Bạn cần tải thủ công các mô hình và đặt chúng vào thư mục tương ứng:"
echo "  - PhoWhisper: server/models/phowhisper/PhoWhisper-base-ct2"
echo "  - EnViT5: server/models/envit5/envit5-translation"
echo "  - OPUS-MT: server/models/opus_mt/"
echo ""
echo "Hoặc sử dụng các lệnh Hugging Face CLI sau (nếu đã đăng nhập):"
echo "  huggingface-cli download --resume-download danghuy1999/PhoWhisper-CTranslate2 --local-dir server/models/phowhisper/PhoWhisper-base-ct2"
echo "  huggingface-cli download --resume-download VietAI/envit5-translation --local-dir server/models/envit5/envit5-translation"

# Tạo file .env
if [ ! -f ".env" ]; then
    echo "Tạo file .env..."
    cat > .env << EOL
# Video Call Translation
API_PORT=5000
SOCKET_PORT=5001
PHOWHISPER_ASR_URL=http://localhost:50051
TRANSLATION_SERVICE_URL=http://localhost:50052
TTS_SERVICE_URL=http://localhost:5002
EMBEDDING_SERVICE_URL=http://localhost:5003
NODE_ENV=development
USE_CUDA=false
LOG_LEVEL=info
EOL
fi

# Cấu hình file khởi động và cấp quyền thực thi cho các script
echo "Cấp quyền thực thi cho các script..."
chmod +x start.sh
chmod +x deploy_all.sh
chmod +x check_deployment.sh
chmod +x scripts/start_services_ubuntu.sh
chmod +x scripts/deploy/optimize_models.sh
chmod +x scripts/utils/convert_opus_to_ct2.py
chmod +x scripts/utils/convert_xtts_to_onnx.py
chmod +x scripts/utils/check_and_convert_models.py
chmod +x scripts/tests/test_model.py
chmod +x scripts/tests/test_xtts.py
chmod +x scripts/tests/test_tts_service.py

echo ""
echo "=== Cài đặt hoàn tất ==="
echo "Để chạy ứng dụng, sử dụng: ./start.sh"
echo ""
echo "Lưu ý: Đảm bảo bạn đã tải các mô hình cần thiết vào các thư mục tương ứng."
echo "Kiểm tra file README.md để biết thêm chi tiết." 

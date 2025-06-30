# Hệ thống dịch thuật video call thời gian thực

Hệ thống dịch thuật video call thời gian thực tích hợp các công nghệ nhận dạng giọng nói, dịch thuật và tổng hợp giọng nói để thực hiện dịch thuật hai chiều trong các cuộc gọi video.

## Cấu trúc dự án

```
video-call-translation_OFFICIAL/
├── client/                  # Frontend React/Vite
│   ├── public/
│   └── src/
│       ├── components/      # Các component React
│       ├── config/          # Cấu hình
│       ├── contexts/        # React Context Providers
│       ├── services/        # Service API
│       └── utils/           # Tiện ích
│
├── server/                  # Backend và các dịch vụ
│   ├── api/                 # API server Express.js
│   ├── socket/              # Socket.IO server
│   ├── services/            # Các dịch vụ Python
│   │   ├── phowhisper_asr_service/ # Dịch vụ ASR PhoWhisper
│   │   ├── translation_service/ # Dịch vụ dịch thuật HTTP
│   │   ├── tts_service/     # Dịch vụ TTS HTTP
│   │   └── embeddings_service/ # Dịch vụ nhúng văn bản
│   │
│   └── models/              # Thư mục chứa mô hình
│       ├── phowhisper/      # Mô hình PhoWhisper ASR
│       │   ├── PhoWhisper-base/    # Mô hình PyTorch
│       │   └── PhoWhisper-base-ct2/  # Mô hình CTranslate2
│       ├── opus_mt/         # Mô hình dịch OPUS-MT
│       │   ├── en_vi_model/
│       │   └── vi_en_model/
│       ├── tts/             # Mô hình XTTS và speakers
│       │   ├── XTTS-v2/
│       │   └── speakers/
│       └── embeddings/      # Mô hình nhúng văn bản
│
├── scripts/                 # Scripts tự động hóa
│   ├── deploy/              # Scripts triển khai
│   │   ├── docker/          # Dockerfile
│   │   └── nginx/           # Cấu hình Nginx
│   ├── tests/               # Scripts kiểm thử
│   └── utils/               # Scripts tiện ích
├── docs/                    # Tài liệu
├── venv/                    # Môi trường ảo Python chính (chỉ dùng cho phát triển cục bộ)
└── venv_tts/                # Môi trường ảo Python cho TTS (chỉ dùng cho phát triển cục bộ)
```

## Các thành phần chính

1. **Frontend**: React.js + Vite với giao diện người dùng cho video call và hiển thị phụ đề
2. **API Server**: Node.js + Express.js xử lý các request HTTP
3. **Socket Server**: Socket.IO xử lý kết nối realtime cho truyền âm thanh và nhận kết quả
4. **ASR Service**: Dịch vụ nhận dạng giọng nói sử dụng mô hình PhoWhisper
5. **Translation Service**: Dịch vụ dịch thuật sử dụng mô hình OPUS-MT
6. **TTS Service**: Dịch vụ tổng hợp giọng nói sử dụng mô hình XTTS-v2
7. **Embeddings Service**: Dịch vụ nhúng văn bản cho xử lý ngữ cảnh

## Yêu cầu hệ thống

- Node.js >= 14
- Python >= 3.9
- 8GB RAM trở lên
- (Khuyến nghị) NVIDIA GPU với CUDA 11.8+ và 8GB VRAM
  - Hiện tại đã tối ưu cho card GPU NVIDIA T4

## Cài đặt

### Cách 1: Cài đặt tự động
```bash
# Trên Linux/macOS
bash scripts/setup.sh

# Trên Windows
scripts\setup.bat
```

### Cách 2: Cài đặt thủ công

1. **Cài đặt các dependency Node.js**:
```bash
npm install
cd client && npm install
cd ..
```

2. **Tạo môi trường Python và cài đặt các gói**:
```bash
# Môi trường chính
python -m venv venv
# Trên Linux/macOS
source venv/bin/activate
# Trên Windows
venv\Scripts\activate
pip install -r requirements.txt

# Môi trường TTS (tùy chọn - nếu sử dụng TTS riêng)
python -m venv venv_tts
# Trên Linux/macOS
source venv_tts/bin/activate
# Trên Windows
venv_tts\Scripts\activate
pip install gTTS==2.5.4 huggingface-hub==0.31.2
```

3. **Tải các mô hình**:
```bash
npm run download:models
```

## Khởi động ứng dụng

### Trên Windows
```bash
# Khởi động tất cả các dịch vụ
start.bat

# Khởi động dịch vụ socket riêng (cho điều chỉnh và debug)
debug_socket.bat
```

### Trên Linux/macOS
```bash
# Khởi động tất cả các dịch vụ
./start.sh

# Khởi động từng dịch vụ riêng biệt
npm run dev:api          # API server
npm run dev:socket       # Socket server
npm run start:services   # Các dịch vụ Python
npm run client           # Frontend
```

## Truy cập ứng dụng

Frontend được phục vụ tại:
- **Môi trường phát triển**: http://localhost:3000
- **Môi trường Docker**: http://localhost:8081

## Sử dụng Docker
```bash
# Build các image
npm run docker:build

# Khởi động toàn bộ hệ thống
npm run docker:up

# Dừng hệ thống
npm run docker:down
```

## Cấu hình

Hệ thống sử dụng file `.env` để cấu hình:

```
# Cấu hình server
API_PORT=5000
SOCKET_PORT=5001

# URL dịch vụ (Development)
PHOWHISPER_ASR_URL=http://localhost:50051
TRANSLATION_SERVICE_URL=http://localhost:50052
TTS_SERVICE_URL=http://localhost:5002
EMBEDDING_SERVICE_URL=http://localhost:5003

# URL dịch vụ (Docker)
# PHOWHISPER_ASR_URL=http://phowhisper:50051
# TRANSLATION_SERVICE_URL=http://translation:50052
# TTS_SERVICE_URL=http://tts:5002
# EMBEDDING_SERVICE_URL=http://embeddings:5003

# Cấu hình GPU
USE_CUDA=true      # true nếu sử dụng GPU, false nếu sử dụng CPU
GPU_DEVICE=0       # GPU đầu tiên (0), thứ hai (1), v.v.
BATCH_SIZE=8       # Tăng giá trị này nếu có GPU mạnh hơn
```

## Tối ưu hóa mô hình

Dự án hiện đang sử dụng mô hình PhoWhisper-base. Để nâng cấp lên PhoWhisper-medium để cải thiện độ chính xác:

1. Tải mô hình PhoWhisper-medium:
```bash
python scripts/download_model.py --model phowhisper-medium
```

2. Chuyển đổi mô hình sang CTranslate2:
```bash
python scripts/convert_model.py --model phowhisper-medium
```

3. Cập nhật biến môi trường:
```
# Trong .env hoặc docker-compose.yml
MODEL_PATH=/app/models/phowhisper/PhoWhisper-medium-ct2
```

## Tài liệu

Tài liệu chi tiết về dự án, hướng dẫn tối ưu hóa, và các ghi chú triển khai có thể được tìm thấy trong thư mục `docs/`.

## Giấy phép

MIT

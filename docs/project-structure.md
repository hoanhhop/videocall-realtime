# Cấu trúc dự án

Tài liệu này giải thích cấu trúc thư mục của dự án và cách tổ chức các thành phần.

## Tổng quan

Dự án được tổ chức theo cấu trúc module rõ ràng, phân tách các thành phần chức năng và tối ưu hóa cho cả phát triển và triển khai:

```
video-call-translation/
├── client/                  # Frontend React/Vite
├── server/                  # Backend và các dịch vụ
│   ├── api/                 # API server
│   ├── socket/              # Socket server
│   ├── models/              # Thư mục chứa mô hình
│   └── services/            # Các dịch vụ Python
│       ├── phowhisper_asr_service/ # Dịch vụ ASR (nhận dạng giọng nói)
│       ├── translation_service/    # Dịch vụ dịch
│       └── tts_service/            # Dịch vụ TTS (tổng hợp giọng nói)
├── scripts/                 # Scripts tự động hóa
│   ├── deploy/              # Scripts triển khai
│   │   ├── docker/          # Dockerfile 
│   │   └── nginx/           # Cấu hình Nginx
│   ├── tests/               # Scripts kiểm thử
│   └── utils/               # Scripts tiện ích
└── docs/                    # Tài liệu
```

## Mô tả chi tiết

### 1. Client (Frontend)

Thư mục `client/` chứa ứng dụng frontend được xây dựng bằng React và Vite. Ứng dụng cung cấp giao diện người dùng cho video call và hiển thị phụ đề thời gian thực.

### 2. Server (Backend)

Thư mục `server/` được tổ chức thành ba thành phần chính:

- **API Server** (`server/api/`): Xử lý các request HTTP, quản lý xác thực, và cung cấp REST API.
- **Socket Server** (`server/socket/`): Quản lý kết nối WebSocket thời gian thực cho truyền âm thanh và nhận kết quả.
- **Models** (`server/models/`): Chứa các mô hình machine learning:
  - `server/models/phowhisper/`: Mô hình PhoWhisper ASR
  - `server/models/opus_mt/`: Mô hình OPUS-MT Translation
  - `server/models/tts/`: Mô hình XTTS-v2 TTS
- **Services** (`server/services/`): Chứa các dịch vụ microservice Python:
  - **PhoWhisper ASR** (`server/services/phowhisper_asr_service/`): Dịch vụ nhận dạng giọng nói sử dụng PhoWhisper
  - **Translation** (`server/services/translation_service/`): Dịch vụ dịch thuật sử dụng OPUS-MT
  - **TTS** (`server/services/tts_service/`): Dịch vụ tổng hợp giọng nói sử dụng XTTS-v2

### 3. Scripts

Thư mục `scripts/` chứa các script tự động hóa để cài đặt, cấu hình và khởi động hệ thống:

- **Deploy** (`scripts/deploy/`): Scripts và cấu hình triển khai:
  - `scripts/deploy/deploy.sh`: Script triển khai cho Ubuntu
  - `scripts/deploy/optimize_models.sh`: Script tối ưu hóa mô hình 
  - `scripts/deploy/docker/`: Dockerfile cho các dịch vụ
  - `scripts/deploy/nginx/`: Cấu hình Nginx
- **Tests** (`scripts/tests/`): Scripts kiểm thử:
  - `scripts/tests/test_model.py`: Kiểm thử mô hình
  - `scripts/tests/test_tts_service.py`: Kiểm thử dịch vụ TTS
- **Utils** (`scripts/utils/`): Scripts tiện ích:
  - `scripts/utils/convert_opus_to_ct2.py`: Chuyển đổi mô hình OPUS-MT sang CTranslate2
  - `scripts/utils/convert_xtts_to_onnx.py`: Chuyển đổi mô hình XTTS sang ONNX
- Các script khác:
  - `scripts/system_check.py`: Kiểm tra cấu hình hệ thống
  - `scripts/download_models.py`: Script tải mô hình từ HuggingFace
  - `scripts/start_services_ubuntu.sh`: Script khởi động các dịch vụ Python

### 4. Docs

Thư mục `docs/` chứa tài liệu dự án:

- `docs/project-structure.md`: Tài liệu này

## Quy ước đặt tên

- **Kebab-case** cho tên thư mục và file trong dự án (ví dụ: `video-call-translation`)
- **Camel case** cho biến trong JavaScript/TypeScript
- **Snake case** cho biến trong Python

## Luồng dữ liệu chính

1. Client gửi dữ liệu âm thanh thông qua Socket.IO
2. Socket Server chuyển âm thanh tới dịch vụ ASR
3. ASR chuyển âm thanh thành văn bản và phát hiện ngôn ngữ
4. Socket Server gửi văn bản tới dịch vụ Translation
5. Translation dịch văn bản và trả về kết quả
6. Socket Server gửi văn bản đã dịch tới dịch vụ TTS 
7. TTS chuyển văn bản thành giọng nói
8. Socket Server gửi giọng nói và phụ đề văn bản về cho Client 

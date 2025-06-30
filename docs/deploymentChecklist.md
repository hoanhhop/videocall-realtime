# Danh sách kiểm tra triển khai trên Ubuntu VM

## Chuẩn bị môi trường

- [ ] Cài đặt Git
- [ ] Cài đặt Node.js (v14+) và npm
- [ ] Cài đặt Python 3.9+ và venv
- [ ] Cài đặt Docker và Docker Compose
- [ ] (Tùy chọn) Cài đặt NVIDIA Drivers và NVIDIA Docker runtime

## Clone và cài đặt mã nguồn

- [ ] Clone repository
```
git clone https://github.com/yourusername/video-call-translation.git
cd video-call-translation
```
- [ ] Tạo và cập nhật file .env từ .env.example
```
cp .env.example .env
# Chỉnh sửa .env nếu cần
```

## Tải các mô hình cần thiết

- [ ] Tải mô hình PhoWhisper-base-ct2
```
mkdir -p server/models/phowhisper/PhoWhisper-base-ct2
# Tải từ nguồn hoặc huggingface
```
- [ ] Tải mô hình OPUS-MT cho dịch Việt-Anh và Anh-Việt
```
mkdir -p server/models/opus_mt
python scripts/download_opus_mt.py
```
- [ ] Chuyển đổi mô hình OPUS-MT sang định dạng CT2 để tăng tốc
```
python convert_opus_to_ct2.py --model_path server/models/opus_mt/opus-mt-en-vi --output_path server/models/opus_mt/opus-mt-en-vi-ct2 --quantization float16
python convert_opus_to_ct2.py --model_path server/models/opus_mt/opus-mt-vi-en --output_path server/models/opus_mt/opus-mt-vi-en-ct2 --quantization float16
```
- [ ] Tải mô hình TTS
```
mkdir -p server/models/tts/XTTS-v2
# Tải từ nguồn hoặc huggingface
```

## Tạo môi trường Python

- [ ] Tạo và kích hoạt môi trường ảo
```
python -m venv venv
source venv/bin/activate  # Linux/macOS
```
- [ ] Cài đặt các phụ thuộc Python
```
pip install -r requirements-server.txt
```

## Cài đặt Node.js dependencies

- [ ] Cài đặt dependencies cho server
```
cd server
npm install
cd ..
```
- [ ] Cài đặt dependencies cho client
```
cd client
npm install
cd ..
```

## Tối ưu hóa hệ thống

- [ ] Tối ưu cho môi trường VM (nếu triển khai trên VM)
```
chmod +x optimize_vm.sh
./optimize_vm.sh
```

- [ ] Tối ưu cho c2d-standard-8 VM (8 vCPUs, 32GB Memory)
```
chmod +x scripts/optimize_for_c2d_vm.sh
./scripts/optimize_for_c2d_vm.sh
```

- [ ] Tạo các thư mục model và cấu hình Docker tối ưu
```
# Tạo docker-compose.optimized.yml để giới hạn tài nguyên
# Tối ưu CPU và bộ nhớ cho từng service
cp scripts/deploy/docker-compose.optimized.yml .
```

## Kiểm tra các dịch vụ

- [ ] Kiểm tra dịch vụ ASR (PhoWhisper)
```
cd server/services/phowhisper_asr_service
python run_phowhisper.py
# Kiểm tra terminal để đảm bảo dịch vụ khởi động thành công
```

- [ ] Kiểm tra dịch vụ Translation
```
cd server/services/translation_service
python run_translation.py
# Kiểm tra terminal để đảm bảo dịch vụ khởi động thành công
```

- [ ] Kiểm tra dịch vụ TTS
```
cd server/services/tts_service
python run_tts.py
# Kiểm tra terminal để đảm bảo dịch vụ khởi động thành công
```

## Triển khai với Docker

- [ ] Xây dựng và chạy với Docker Compose tiêu chuẩn
```
docker-compose build
docker-compose up -d
```

- [ ] Xây dựng và chạy với Docker Compose tối ưu (cho c2d-standard-8 VM)
```
docker-compose -f docker-compose.yml -f docker-compose.optimized.yml build
docker-compose -f docker-compose.yml -f docker-compose.optimized.yml up -d
```

- [ ] Kiểm tra các container đã khởi chạy
```
docker ps
```

## Kiểm tra API và Socket

- [ ] Kiểm tra API server
```
curl http://localhost:5000/api/health
```

- [ ] Kiểm tra Socket server
```
curl http://localhost:5001/socket.io/
```

## Kiểm tra ứng dụng web

- [ ] Mở trình duyệt và truy cập ứng dụng
```
http://localhost:3000
```

## Xử lý sự cố

- [ ] Kiểm tra logs
```
docker-compose logs -f api
docker-compose logs -f socket
docker-compose logs -f phowhisper
docker-compose logs -f translation
docker-compose logs -f tts
```

- [ ] Kiểm tra trạng thái Docker
```
docker-compose ps
```

## Tài nguyên bổ sung

- Sử dụng `htop` hoặc `nvidia-smi` để giám sát tài nguyên hệ thống
- Đặt `debug` hoặc `LOG_LEVEL=debug` trong `.env` để có thêm thông tin debug 

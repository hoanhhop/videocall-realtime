# Hướng dẫn triển khai Video Call Translation trên Ubuntu

Tài liệu này hướng dẫn cách thiết lập và chạy hệ thống Video Call Translation trên máy chủ Ubuntu.

## Yêu cầu hệ thống

- Ubuntu 20.04 LTS hoặc mới hơn
- Python 3.8 hoặc mới hơn
- Node.js 14 hoặc mới hơn
- NPM 6 hoặc mới hơn
- RAM tối thiểu 8GB (khuyến nghị 16GB)
- Ổ cứng trống tối thiểu 10GB (để lưu trữ mô hình và thư viện)
- GPU NVIDIA (tùy chọn, cho hiệu suất tốt hơn)

## Bước 1: Cài đặt các gói phụ thuộc cần thiết

```bash
# Cài đặt Node.js và npm
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# Cài đặt các gói phụ thuộc cần thiết
sudo apt-get update
sudo apt-get install -y python3-pip python3-venv ffmpeg build-essential libsndfile1 portaudio19-dev
sudo apt-get install -y libavformat-dev libavcodec-dev libavdevice-dev libavutil-dev libswscale-dev libswresample-dev libavfilter-dev

# Kiểm tra phiên bản Python và Node.js
python3 --version
node --version
npm --version
```

## Bước 2: Clone repository

```bash
git clone <your-repo-url> video-call-translation
cd video-call-translation
```

## Bước 3: Chạy script cài đặt tự động

Chạy script cài đặt tự động để thiết lập môi trường, cài đặt các gói phụ thuộc và tải mô hình:

```bash
# Cho phép chạy script
chmod +x setup_ubuntu.sh

# Chạy script cài đặt
./setup_ubuntu.sh
```

Hoặc sử dụng lệnh npm:

```bash
npm run setup:ubuntu
```

Script này sẽ:
- Tạo và kích hoạt môi trường ảo Python
- Cài đặt tất cả các gói Python cần thiết
- Cài đặt PyAV (av) đúng cách
- Cài đặt các gói Node.js cho server và client
- Tạo cấu trúc thư mục cần thiết
- Tạo file .env với cấu hình mặc định

## Bước 4: Tải xuống các mô hình

Bạn cần tải các mô hình sau:

1. **PhoWhisper ASR** (cho nhận dạng tiếng Việt):
   ```bash
   pip install huggingface-hub
   huggingface-cli download --resume-download danghuy1999/PhoWhisper-CTranslate2 --local-dir server/models/phowhisper/PhoWhisper-base-ct2
   ```

2. **EnViT5** (cho dịch thuật):
   ```bash
   huggingface-cli download --resume-download VietAI/envit5-translation --local-dir server/models/envit5/envit5-translation
   ```

3. **OPUS-MT** (cho dịch thuật):
   ```bash
   huggingface-cli download --resume-download Helsinki-NLP/opus-mt-en-vi --local-dir server/models/opus_mt/en_vi_model
   huggingface-cli download --resume-download Helsinki-NLP/opus-mt-vi-en --local-dir server/models/opus_mt/vi_en_model
   ```

## Bước 5: Khởi động ứng dụng

### Sử dụng script bash

```bash
chmod +x start.sh
./start.sh
```

Script này sẽ hiển thị menu cho phép bạn chọn cách khởi động ứng dụng.

### Sử dụng npm

```bash
# Khởi động tất cả các dịch vụ (API, Socket, Các dịch vụ Python, Client)
npm run start:all:ubuntu

# Hoặc khởi động từng dịch vụ
npm run start:services:ubuntu  # Khởi động các dịch vụ Python
npm run dev:api                # Khởi động API Server
npm run dev:socket             # Khởi động Socket Server
npm run client                 # Khởi động Client
```

## Kiểm tra dịch vụ

Sau khi khởi động, bạn có thể kiểm tra các dịch vụ qua các URL sau:

- API Server: http://localhost:5000/api
- Socket Server: http://localhost:5001
- PhoWhisper ASR: http://localhost:50051/health
- Translation Service: http://localhost:50052/health
- TTS Service: http://localhost:5002/health
- Client UI: http://localhost:3000

## Xử lý sự cố phổ biến

### 1. Lỗi PyAV (av)

Nếu gặp lỗi "ModuleNotFoundError: No module named 'av'", đảm bảo bạn đã cài đặt PyAV với các thư viện phụ thuộc:

```bash
# Cài đặt các thư viện phụ thuộc của PyAV
sudo apt-get install -y libavformat-dev libavcodec-dev libavdevice-dev libavutil-dev libswscale-dev libswresample-dev libavfilter-dev

# Gỡ cài đặt av hiện tại nếu có
pip uninstall -y av pyav

# Cài đặt av từ nguồn
pip install av --no-binary av

# Kiểm tra cài đặt
python -c "import av; print(av.__version__)"
```

Nếu vẫn gặp lỗi, thử cài đặt từ conda-forge (nếu bạn sử dụng Conda):

```bash
conda install -c conda-forge av
```

### 2. Lỗi mô hình không tải được

Kiểm tra thư mục mô hình:

```bash
ls -la server/models/phowhisper/PhoWhisper-base-ct2
ls -la server/models/envit5/envit5-translation
ls -la server/models/opus_mt/en_vi_model
ls -la server/models/opus_mt/vi_en_model
```

### 3. Lỗi khi khởi động các dịch vụ

Kiểm tra các file log:

```bash
cat logs/PhoWhisper_ASR.log
cat logs/Translation.log
cat logs/TTS.log
```

### 4. Lỗi "gnome-terminal: command not found"

Nếu bạn gặp lỗi này khi chạy `start.sh`, đảm bảo bạn đã cài đặt gnome-terminal hoặc sử dụng terminal khác:

```bash
# Cài đặt gnome-terminal
sudo apt-get install -y gnome-terminal

# Hoặc sửa file start.sh để sử dụng x-terminal-emulator hoặc xterm:
# Thay đổi 'gnome-terminal' thành 'x-terminal-emulator' hoặc 'xterm'
```

Bạn cũng có thể sử dụng `start_services_ubuntu.sh` thay vì dùng start.sh:

```bash
# Khởi động dịch vụ Python
bash scripts/start_services_ubuntu.sh

# Mở terminal khác và khởi động các dịch vụ Node.js
npm run dev:api
npm run dev:socket
npm run client
```

## Triển khai trên môi trường Production

Để triển khai trên môi trường production, bạn nên:

1. Sử dụng PM2 để quản lý các tiến trình Node.js
2. Cấu hình Nginx làm reverse proxy
3. Thiết lập SSL bằng Certbot/Let's Encrypt
4. Sử dụng systemd để khởi động các dịch vụ Python tự động khi khởi động lại máy chủ

Ví dụ cấu hình PM2:

```bash
# Cài đặt PM2
npm install -g pm2

# Khởi động API server với PM2
pm2 start server/api/server.js --name "api-server"

# Khởi động Socket server với PM2
pm2 start server/socket/server.js --name "socket-server"

# Lưu cấu hình để tự động khởi động khi reboot
pm2 save
pm2 startup
```

Ví dụ unit file systemd cho các dịch vụ Python (tạo tệp `/etc/systemd/system/phowhisper.service`):

```
[Unit]
Description=PhoWhisper ASR Service
After=network.target

[Service]
User=your_username
WorkingDirectory=/path/to/video-call-translation
ExecStart=/path/to/video-call-translation/venv/bin/python /path/to/video-call-translation/server/services/phowhisper_asr_service/run_phowhisper.py
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## Lưu ý quan trọng

- Đảm bảo các cổng cần thiết đã được mở trên firewall:
  ```bash
  sudo ufw allow 5000/tcp  # API
  sudo ufw allow 5001/tcp  # Socket
  sudo ufw allow 50051/tcp # ASR
  sudo ufw allow 50052/tcp # Translation
  sudo ufw allow 5002/tcp  # TTS
  sudo ufw allow 3000/tcp  # Client
  ```

- Nếu sử dụng GPU NVIDIA, hãy đảm bảo đã cài đặt các driver và CUDA:
  ```bash
  # Kiểm tra GPU
  nvidia-smi
  
  # Sửa file .env để kích hoạt CUDA
  sed -i 's/USE_CUDA=false/USE_CUDA=true/g' .env
  ``` 

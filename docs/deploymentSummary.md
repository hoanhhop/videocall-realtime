# Tóm tắt hệ thống và các bước chuẩn bị triển khai

## Kiến trúc hệ thống

Hệ thống dịch thuật video call thời gian thực gồm các thành phần sau:

1. **Frontend Client**: Ứng dụng web React/Vite cho giao diện người dùng
2. **API Server**: Node.js + Express xử lý yêu cầu HTTP
3. **Socket Server**: Socket.IO xử lý kết nối thời gian thực
4. **Dịch vụ PhoWhisper ASR**: Nhận dạng giọng nói sử dụng mô hình PhoWhisper
5. **Dịch vụ Translation**: Dịch văn bản sử dụng mô hình OPUS-MT
6. **Dịch vụ TTS**: Tổng hợp giọng nói sử dụng mô hình XTTS-v2

## Luồng dữ liệu

1. Client ghi âm giọng nói và gửi dữ liệu âm thanh qua Socket.IO
2. Socket Server nhận dữ liệu âm thanh và chuyển tiếp đến dịch vụ PhoWhisper ASR
3. PhoWhisper ASR nhận dạng giọng nói thành văn bản và phát hiện ngôn ngữ
4. Socket Server nhận kết quả và gửi văn bản đến dịch vụ Translation
5. Dịch vụ Translation dịch văn bản sang ngôn ngữ đích
6. Socket Server gửi kết quả dịch về client
7. (Tùy chọn) Client yêu cầu tổng hợp giọng nói từ dịch vụ TTS

## Các bước đã thực hiện

1. **Kiểm tra cấu trúc hệ thống**: Đã hiểu rõ cách các thành phần tương tác với nhau
2. **Sửa file start.bat**: Đã chuyển từ môi trường `venv_new` sang `venv` vì môi trường `venv_new` bị hỏng
3. **Xử lý xung đột phụ thuộc**: Đã ghi nhận các vấn đề phụ thuộc giữa `TTS` và `faster-whisper`
4. **Tạo script start.sh**: Đã tạo phiên bản Linux của script khởi động để triển khai trên Ubuntu VM
5. **Tạo danh sách kiểm tra triển khai**: Đã liệt kê các bước cần thiết để cài đặt hệ thống trên Ubuntu VM

## Vấn đề đã được giải quyết

1. **Môi trường Python**: Đã chuyển từ `venv_new` sang `venv` đã có sẵn thư viện `av` (PyAV)
2. **Xung đột thư viện**: Đã hiểu rõ xung đột giữa `TTS==0.22.0` và `faster-whisper 0.10.0` và đề xuất giải pháp
3. **Triển khai Ubuntu**: Đã chuẩn bị các file cấu hình và script cần thiết cho môi trường Ubuntu
4. **Tối ưu hệ thống**: Đã chuyển từ EnVi-T5 sang OPUS-MT và tối ưu với CTranslate2
5. **Lỗi Docker build**: Đã khắc phục lỗi "no space left on device" bằng cách loại bỏ các thư mục mô hình không cần thiết
6. **Tối ưu VM**: Đã tạo cấu hình tối ưu cho VM c2d-standard-8 (8 vCPUs, 32GB Memory)

## Khuyến nghị khi triển khai

1. **Sử dụng Docker với cấu hình tối ưu**: Triển khai bằng Docker Compose với file `docker-compose.optimized.yml` 
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.optimized.yml up -d
   ```

2. **Chuyển đổi mô hình để tăng hiệu suất**:
   - Chuyển đổi OPUS-MT sang CT2:
     ```bash
     python convert_opus_to_ct2.py --model_path server/models/opus_mt/opus-mt-en-vi --quantization float16
     python convert_opus_to_ct2.py --model_path server/models/opus_mt/opus-mt-vi-en --quantization float16
     ```
   - Chuẩn bị XTTS-v2 cho ONNX:
     ```bash
     python convert_xtts_to_onnx.py
     ```

3. **Theo dõi và phân bổ tài nguyên**:
   - PhoWhisper ASR: 2 vCPUs, 8GB RAM (~30% GPU)
   - Translation: 2 vCPUs, 8GB RAM (~30% GPU)
   - TTS: 2 vCPUs, 8GB RAM (~30% GPU)
   - Node.js services: 1 vCPU, 2GB RAM mỗi service

4. **Giám sát hiệu suất**: Sử dụng công cụ monitoring để theo dõi độ trễ và tài nguyên:
   ```bash
   scripts/monitor_services.bat # Windows
   # hoặc
   scripts/monitor_services.sh # Linux
   ```

## Tài liệu tham khảo

- README.md: Thông tin tổng quan về hệ thống
- deploymentChecklist.md: Danh sách kiểm tra chi tiết cho việc triển khai
- start.sh: Script khởi động cho Ubuntu
- docker-compose.yml: Cấu hình Docker Compose cho triển khai container 

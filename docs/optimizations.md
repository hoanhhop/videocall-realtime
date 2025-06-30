# Tối ưu hóa hệ thống dịch thuật video call thời gian thực

Tài liệu này ghi lại các tối ưu hóa đã được áp dụng cho hệ thống dịch thuật video call thời gian thực để giảm độ trễ và cải thiện hiệu suất tổng thể.

## 0. Tối ưu cho c2d-standard-8 VM (8 vCPUs, 32 GB Memory)

### Thay đổi chính:
- **Chuyển từ EnVi-T5 sang OPUS-MT**: Sử dụng mô hình OPUS-MT cho dịch thuật Anh-Việt, Việt-Anh với chất lượng cao hơn và tài nguyên thấp hơn
- **Tối ưu Docker images**: Sửa Dockerfile để chỉ bao gồm thư mục mô hình cần thiết, giải quyết lỗi "no space left on device"
- **Phân bổ tài nguyên**: Phân chia tài nguyên hợp lý cho các dịch vụ trên VM c2d-standard-8

### Phân bổ tài nguyên trên VM:
| Service | vCPUs | Bộ nhớ | GPU Memory |
|---------|-------|--------|------------|
| PhoWhisper ASR | 2 | 8GB | ~30% |
| Translation (OPUS-MT) | 2 | 8GB | ~30% |
| TTS (XTTS-v2) | 2 | 8GB | ~30% |
| Node.js services (API, Socket) | 1 each | 2GB each | N/A |
| Các dịch vụ khác | 0.5 each | 0.5-1GB each | N/A |

### Công cụ tối ưu hóa mới:
- `convert_opus_to_ct2.py`: Chuyển đổi mô hình OPUS-MT sang định dạng CTranslate2
- `convert_xtts_to_onnx.py`: Chuẩn bị mô hình XTTS cho định dạng ONNX
- `optimize_system.bat`: Công cụ tương tác để áp dụng tối ưu hóa trên Windows
- `scripts/optimize_for_c2d_vm.sh`: Áp dụng tối ưu hóa cho VM c2d-standard-8

## 1. Dịch vụ PhoWhisper ASR

### Tối ưu hóa mô hình:
- **Sử dụng CTranslate2**: Mô hình PhoWhisper được chuyển đổi sang định dạng CTranslate2 để cải thiện tốc độ inference
- **Precision FP16/INT8**: Sử dụng precision FP16 trên GPU và INT8 trên CPU để tăng tốc độ xử lý
- **Beam Size nhỏ**: Sử dụng beam size=1 để giảm thời gian inference và sử dụng beam size=5 cho kết quả cuối cùng
- **Văn bản prompt**: Cải thiện độ chính xác bằng cách sử dụng văn bản đã nhận dạng trước đó làm prompt

### Tối ưu hóa xử lý âm thanh:
- **VAD (Voice Activity Detection)**: Chỉ xử lý khi phát hiện giọng nói để giảm tải cho hệ thống
- **Silence timeouts**: Điều chỉnh thời gian im lặng để cân bằng giữa độ nhạy và hiệu suất
- **Audio buffer**: Xử lý buffer âm thanh linh hoạt để duy trì ngữ cảnh giữa các phân đoạn

### Tối ưu hóa parallelization:
- **Thread workers**: Số lượng worker thread được điều chỉnh theo số lõi CPU
- **Batch processing**: Xử lý nhiều audio chunk cùng lúc với kích thước batch phù hợp

## 2. Dịch vụ Translation 

### Tối ưu hóa mô hình:
- **OPUS-MT với CTranslate2**: Chuyển đổi mô hình OPUS-MT sang định dạng CTranslate2 để tăng tốc độ inference (gấp 4 lần)
- **Quantization**: Mô hình được lượng tử hóa với float16 trên GPU hoặc int8 trên CPU để giảm bộ nhớ và tăng tốc độ
- **Beam size tùy chỉnh**: Giảm beam size xuống 2-3 để cân bằng giữa độ chính xác và tốc độ
- **Batch processing**: Tăng kích thước batch (16) để tối ưu hiệu suất xử lý song song

### Tối ưu hóa văn bản:
- **Chunking**: Chia văn bản dài thành các đoạn ngắn hơn để xử lý song song
- **Caching văn bản đã dịch**: Lưu trữ và tái sử dụng kết quả dịch của các câu thường gặp
- **Context-aware translation**: Sử dụng ngữ cảnh từ các câu trước đó để cải thiện độ chính xác

### Tối ưu hóa server:
- **API batching**: Gom nhóm các yêu cầu dịch thuật để giảm số lần gọi API
- **Streaming response**: Trả về kết quả dần dần khi có sẵn thay vì đợi toàn bộ dịch xong

## 3. Dịch vụ TTS

### Tối ưu hóa mô hình:
- **Mô hình XTTS-v2**: Sử dụng mô hình XTTS thế hệ mới với chất lượng cao và tốc độ nhanh
- **Speaker embeddings caching**: Lưu trữ và tái sử dụng speaker embeddings để tránh tính toán lại
- **ONNX Runtime**: Cân nhắc sử dụng ONNX Runtime để tăng tốc inference (dự kiến cập nhật)

### Tối ưu hóa synthesis:
- **Chunking văn bản**: Chia văn bản dài thành các chunk nhỏ hơn để tổng hợp song song
- **Stream synthesis**: Bắt đầu phát âm thanh ngay khi chunk đầu tiên được tổng hợp xong
- **Âm thanh progressive**: Gửi từng đoạn âm thanh ngay khi sẵn sàng thay vì đợi toàn bộ âm thanh
- **Điều chỉnh tốc độ**: Tăng tốc độ nói (speech rate) lên 1.1-1.2 để giảm độ trễ tổng thể

## 4. Tối ưu hóa tổng thể hệ thống

### Kiến trúc microservices:
- **Giao tiếp bất đồng bộ**: Sử dụng WebSocket và Socket.IO để giao tiếp thời gian thực
- **Tiến trình song song**: Chạy các dịch vụ ASR, MT và TTS song song để tối đa hóa throughput
- **HTTP/2 và gRPC**: Sử dụng các giao thức hiệu quả hơn cho giao tiếp giữa các dịch vụ

### Tối ưu hóa server:
- **Load balancing**: Phân phối tải đều cho các dịch vụ để tránh bottleneck
- **Horizontal scaling**: Khả năng mở rộng ngang nhiều instance cho các dịch vụ
- **Health monitoring**: Giám sát sức khỏe của hệ thống liên tục và tự động khôi phục

### Tối ưu hóa frontend:
- **Hiển thị phụ đề tức thì**: Hiển thị văn bản ngay khi nhận được kết quả ASR, không đợi hoàn tất dịch
- **Progressive UI updates**: Cập nhật UI liên tục khi có kết quả mới
- **Đệm dữ liệu**: Đệm âm thanh và văn bản phù hợp để tạo trải nghiệm mượt mà

## Kết quả hiệu suất

Với các tối ưu hóa trên, hệ thống đạt được hiệu suất như sau:

**Môi trường CPU thông thường (i5/i7 thế hệ 11+)**:
- PhoWhisper ASR (CTranslate2): ~1.0-1.5s
- OPUS-MT Translation (CT2): ~0.1-0.2s (nhanh hơn so với EnVi-T5: ~0.3-0.5s)
- XTTS-v2 TTS: ~0.3-0.5s
- **Tổng độ trễ: ~1.4-2.2s**

**Môi trường GPU (NVIDIA GTX 1650+)**:
- PhoWhisper ASR (CTranslate2 FP16): ~0.4-0.6s
- OPUS-MT Translation (CT2 FP16): ~0.03-0.08s (nhanh hơn so với EnVi-T5: ~0.1-0.2s)
- XTTS-v2 TTS (FP16): ~0.15-0.25s
- **Tổng độ trễ: ~0.6-0.9s**

**Môi trường VM c2d-standard-8 (8 vCPUs, 32 GB Memory)**:
- PhoWhisper ASR (CTranslate2 FP16): ~0.3-0.5s
- OPUS-MT Translation (CT2 FP16): ~0.03-0.07s
- XTTS-v2 TTS (ONNX runtime): ~0.1-0.2s
- **Tổng độ trễ: ~0.4-0.8s**

## Hướng phát triển tối ưu hóa tiếp theo

1. **Distillation models**: Nghiên cứu mô hình distilled nhỏ hơn, nhẹ hơn cho ASR và MT
2. **Kết hợp pipeline**: Kết hợp ASR+MT trong một mô hình end-to-end
3. **Incremental TTS**: Cải thiện TTS để tổng hợp giọng nói tăng dần theo thời gian thực
4. **Edge deployment**: Tối ưu hóa để triển khai trên các thiết bị edge với tài nguyên hạn chế
5. **Tối ưu ONNX triệt để**: Áp dụng định dạng ONNX cho tất cả mô hình (ASR, MT, TTS)
6. **Dynamic batching**: Điều chỉnh kích thước batch dựa trên tải hệ thống hiện tại
7. **Caching thông minh**: Cải thiện hệ thống cache dựa trên ngữ cảnh và lịch sử dịch thuật

## Tối ưu Docker và triển khai

Với cấu hình VM c2d-standard-8 (8 vCPUs, 32 GB Memory), cần lưu ý các điểm sau:

1. **Giới hạn tài nguyên Docker**: Sử dụng `deploy.resources.limits` trong docker-compose để kiểm soát CPU và bộ nhớ cho mỗi service
2. **Tránh OOM (Out Of Memory)**: Cấu hình mô hình với `LOW_MEMORY=true` và precision thấp hơn (FP16/INT8)
3. **Tối ưu disk space**: Sử dụng Dockerfile đã được tinh chỉnh để tránh lỗi "no space left on device"
4. **Load balancing**: Nếu cần xử lý nhiều cuộc gọi đồng thời, cân nhắc triển khai nhiều instance và load balancer

Các công cụ và cấu hình tối ưu đã được cung cấp trong thư mục `scripts/` để hỗ trợ quá trình triển khai.

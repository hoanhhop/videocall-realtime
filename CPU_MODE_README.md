# Hướng dẫn chạy hệ thống Video Call Translation trên VM không có GPU

## Tóm tắt các thay đổi

Hệ thống đã được điều chỉnh để chạy tối ưu trên môi trường không có GPU với các thay đổi sau:

1. **Thay đổi Image Docker TTS**:
   - Chuyển từ image PyTorch + CUDA sang image Python nhẹ hơn
   - Giảm các dependency không cần thiết

2. **Tối ưu hóa sử dụng bộ nhớ**:
   - Giảm sample rate xuống 22050 để giảm kích thước audio
   - Giảm chunk size để xử lý các đoạn nhỏ hơn
   - Hạn chế số lượng worker để giảm tiêu thụ bộ nhớ

3. **Hạn chế log và cache**:
   - Thiết lập LOG_LEVEL=WARNING để chỉ ghi log quan trọng
   - Cơ chế tự động dọn dẹp cache khi bộ nhớ đầy
   - Giới hạn tài nguyên cho từng container

4. **Tối ưu hóa CPU**:
   - Cấu hình OMP_NUM_THREADS và MKL_NUM_THREADS để tận dụng đa nhân
   - Batch size được điều chỉnh để phù hợp với CPU

## Cách chạy hệ thống

### 1. Khởi động với cấu hình CPU tối ưu

```bash
# Chạy script khởi động tối ưu CPU
./start_cpu_optimized.bat
```

### 2. Giám sát bộ nhớ

```bash
# Cài đặt psutil nếu cần
pip install psutil

# Chạy script giám sát bộ nhớ với ngưỡng 80%
python scripts/monitor_memory.py --threshold 80 --interval 60
```

### 3. Cấu hình tùy chỉnh

Bạn có thể điều chỉnh file `docker-compose.cpu.yml` nếu cần thay đổi giới hạn tài nguyên.

### 4. Nhật ký và debug

Để xem log của một dịch vụ:

```bash
docker-compose logs -f tts
```

## Giới hạn và lưu ý

1. **Hiệu suất**:
   - Thời gian xử lý trên CPU sẽ chậm hơn đáng kể so với GPU
   - Dịch vụ TTS sẽ tốn nhiều thời gian nhất

2. **Bộ nhớ**:
   - Hệ thống đã được tối ưu để dùng ít bộ nhớ nhất có thể
   - Mỗi service được giới hạn trong một lượng RAM nhất định

3. **Lời khuyên**:
   - Hạn chế chạy nhiều session đồng thời
   - Tắt dịch vụ khi không sử dụng để giải phóng tài nguyên

## Khắc phục sự cố

Nếu hệ thống gặp sự cố do thiếu tài nguyên:

1. Khởi động lại container tương ứng:
   ```bash
   docker-compose restart tts
   ```

2. Nếu hệ thống quá tải, giảm các giá trị trong docker-compose.cpu.yml:
   - Giảm MAX_WORKERS
   - Giảm BATCH_SIZE
   - Tăng giới hạn memory cho container quan trọng

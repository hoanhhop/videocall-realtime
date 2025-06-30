# Hướng dẫn gỡ lỗi và khắc phục sự cố PhoWhisper

## Tổng quan vấn đề

Hệ thống dịch video call gặp sự cố khi client gửi dữ liệu âm thanh đến PhoWhisper nhưng không nhận được kết quả trả về. Tài liệu này sẽ giúp bạn tìm hiểu và khắc phục vấn đề.

## Kiến trúc hệ thống

1. **Client** (cổng 3000): Thu âm qua WebRTC và gửi đến Socket Server
2. **Socket Server** (cổng 5001): Nhận dữ liệu âm thanh từ client và gửi qua gRPC đến PhoWhisper
3. **PhoWhisper Service** (cổng 50051): Chạy trong Docker container, xử lý âm thanh và trả kết quả

## Kiểm tra kết nối

1. **Chạy công cụ kiểm tra kết nối**:
```
cd server
node test-phowhisper-connection.js
```

Nếu kết nối thành công, bạn sẽ thấy tất cả các bài kiểm tra đều thành công.

## Các lỗi thường gặp và cách khắc phục

### 1. Lỗi kết nối gRPC

```
❌ Lỗi kết nối: failed to connect to all addresses
```

**Nguyên nhân:**
- PhoWhisper container không chạy
- Sai địa chỉ hoặc cổng kết nối
- Docker network không được thiết lập đúng

**Cách khắc phục:**
- Kiểm tra trạng thái container: `docker ps | grep phowhisper`
- Kiểm tra logs container: `docker logs phowhisper`
- Khởi động lại container: `docker-compose up -d phowhisper`
- Kiểm tra biến môi trường PHOWHISPER_GRPC_ADDRESS (mặc định là phowhisper:50051)

### 2. Lỗi timeout API

```
❌ Lỗi khi gọi API Recognize: Deadline Exceeded
```

**Nguyên nhân:**
- Mô hình đang tải lần đầu (có thể mất 1-2 phút)
- Máy tính không đủ mạnh để chạy mô hình
- Mô hình bị thiếu file

**Cách khắc phục:**
- Chờ 2-3 phút và thử lại
- Kiểm tra CPU/RAM sử dụng: `docker stats phowhisper`
- Tăng tài nguyên cho container trong docker-compose.yml
- Kiểm tra mô hình trong thư mục models/phowhisper

### 3. Buffer âm thanh không được xử lý

**Nguyên nhân:**
- Buffer âm thanh quá ngắn hoặc không đủ dữ liệu
- Định dạng âm thanh không đúng

**Cách khắc phục:**
- Kiểm tra logs với [HOP_DEBUG] để xem dữ liệu âm thanh nhận và gửi đi
- Giảm minFrameLength trong AUDIO_CONFIG (đã điều chỉnh xuống 0.3s trong bản cập nhật)
- Kiểm tra định dạng âm thanh (nên là 16kHz, 16-bit PCM)

### 4. Kết nối Websocket/Socket.IO không ổn định

**Nguyên nhân:**
- Kết nối mạng không ổn định
- Timeout hoặc cấu hình Socket.IO không phù hợp

**Cách khắc phục:**
- Tăng pingTimeout và pingInterval (đã điều chỉnh trong bản cập nhật)
- Kiểm tra kết nối mạng giữa client và server
- Sử dụng Websocket thay vì Polling khi có thể

## Cách khởi động lại toàn bộ hệ thống

Nếu các biện pháp trên không hiệu quả, bạn có thể thử khởi động lại toàn bộ hệ thống:

```bash
cd server
docker-compose down
docker-compose up -d
cd ..
npm run dev
```

## Kiểm tra logs

Kiểm tra logs để tìm hiểu thêm về vấn đề:

```bash
docker logs phowhisper
docker logs socket-server
npm run dev # Trong terminal khác để xem logs của client
```

## Cấu hình đã được tối ưu

Chúng tôi đã tối ưu hóa các thành phần sau trong bản cập nhật:

1. **Giảm timeout và retry gRPC**: giảm từ 5s xuống 2-3s để phản hồi nhanh hơn với lỗi kết nối
2. **Tăng tần suất kiểm tra kết nối**: thêm kiểm tra sức khỏe định kỳ mỗi 30s
3. **Cải thiện xử lý buffer âm thanh**: giảm ngưỡng phát hiện từ 0.5s xuống 0.3s
4. **Thêm logs chi tiết**: logs với tag [HOP_DEBUG] để theo dõi luồng xử lý âm thanh
5. **Tăng tính ổn định của Socket.IO**: tăng timeout và tần suất ping/pong

## Liên hệ hỗ trợ

Nếu vẫn gặp vấn đề sau khi thử các biện pháp trên, vui lòng liên hệ team phát triển với logs đầy đủ và mô tả chi tiết vấn đề gặp phải. 
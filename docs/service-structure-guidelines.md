# Cấu trúc dịch vụ và hướng dẫn chuẩn hóa

## Tình trạng hiện tại

Dự án video-call-translation hiện đang có sự trùng lặp trong các file và folder ở thư mục `server/services`. Dưới đây là tình trạng hiện tại và các khuyến nghị để chuẩn hóa:

### Dịch vụ TTS (Text-to-Speech)

1. File **ttsService.js**:
   - Đặt tại: `/server/services/ttsService.js`
   - **Status**: ✅ Đang được sử dụng bởi controllers và socket handlers
   - **Ưu tiên sử dụng**: Cao
   - **Logger**: `createLogger('tts-service')`

2. Thư mục **tts/** (KHÔNG SỬ DỤNG):
   - Chứa bản sao của ttsService.js
   - **Status**: ⚠️ Không được sử dụng bởi bất kỳ module nào, đã đánh dấu deprecated
   - **Logger**: `createLogger('tts-service-duplicate')`

3. Thư mục **tts_service/**:
   - **Status**: ✅ Đang được sử dụng trong docker-compose.yml
   - Chứa phiên bản mới nhất của run_tts.py và requirements.txt
   - **Ưu tiên sử dụng**: Cao
   - **Tài liệu**: Đã thêm README.md

4. File **ttsServiceOptimized.js**
   - **Status**: Chứa bản tối ưu hóa nhưng không được sử dụng

### Dịch vụ Translation

1. File **translationService.js**:
   - Đặt tại: `/server/services/translationService.js`
   - **Status**: ✅ Đang được sử dụng bởi controllers và socket handlers
   - **Logger**: `createLogger('translation-service-main')`

2. File **translation/translationService.js**:
   - **Status**: ⚠️ Đã được thay thế bởi file chính trong imports, đã đánh dấu deprecated
   - **Logger**: `createLogger('translation-service-duplicate')`

3. Thư mục **translation/**:
   - Chứa Python service run_translation.py và requirements.txt
   - **Status**: ⚠️ Không được sử dụng trong docker-compose.yml

4. Thư mục **translation_service/**:
   - **Status**: ✅ Đang được sử dụng trong docker-compose.yml
   - Chứa phiên bản mới nhất của run_translation.py
   - **Tài liệu**: Đã thêm README.md

## Hướng dẫn chuẩn hóa

### Ngắn hạn (đã thực hiện) ✅

1. Đã thêm các file README.md giải thích cấu trúc trong các thư mục:
   - `/server/services/README.md`
   - `/server/services/tts_service/README.md`
   - `/server/services/translation_service/README.md`

2. Đã thêm cảnh báo vào các file trùng lặp:
   - `/server/services/tts/ttsService.js`
   - `/server/services/translation/translationService.js`

3. Đã cải thiện tên logger để dễ phân biệt trong logs:
   - `tts-service` vs `tts-service-duplicate`
   - `translation-service-main` vs `translation-service-duplicate`

4. Đã cập nhật imports trong socket handlers để sử dụng các file chính:
   - `/server/socket/streamHandler.js` đã sử dụng `/services/ttsService.js`
   - `/server/socket/streamHandler.js` và `/server/socket/socketController.js` đã cập nhật để sử dụng `/services/translationService.js`

### Trung hạn (đã thực hiện một phần) ⚙️

1. **Dịch vụ TTS**: ✅
   - ✅ Tiếp tục sử dụng `/server/services/ttsService.js` 
   - ✅ Docker tiếp tục build từ `/server/services/tts_service/`
   - ✅ Đã đánh dấu thư mục `tts/` là "deprecated" với comment cảnh báo
   - ⏳ Xem xét loại bỏ hoàn toàn thư mục `tts/` trong tương lai

2. **Dịch vụ Translation**: ✅
   - ✅ Đã quyết định giữ và sử dụng file gốc `/server/services/translationService.js`
   - ✅ Đã cập nhật các imports trong tất cả socket handlers
   - ✅ Docker tiếp tục build từ `/server/services/translation_service/`
   - ⚠️ Thư mục `/server/services/translation/` vẫn tồn tại nhưng đã được đánh dấu là deprecated

### Dài hạn (architecture) 🚀

1. Chuẩn hóa cấu trúc thư mục theo mô hình này:
   ```
   server/
     services/
       tts/
         client.js     # Node.js client code (hiện tại là ttsService.js)
         service/      # Python service code (hiện tại là tts_service/)
       translation/
         client.js     # Node.js client code (hiện tại là translationService.js)
         service/      # Python service code (hiện tại là translation_service/)
       asr/
         client.js     # Node.js client code (hiện tại là speechService.js)
         service/      # Python service code (hiện tại là phowhisper_asr_service/)
   ```

2. Cập nhật các tham chiếu trong docker-compose.yml
3. Viết script migration để chuyển đổi sang cấu trúc mới
4. Tách biệt rõ ràng giữa client code (Node.js) và service code (Python)

## Cách kiểm tra dịch vụ đang được sử dụng

Để kiểm tra dịch vụ nào đang được sử dụng, có thể dùng các lệnh sau:

```bash
# Kiểm tra file nào tham chiếu đến ttsService.js
grep -r "require.*ttsService" server/

# Kiểm tra file nào tham chiếu đến translationService.js
grep -r "require.*translationService" server/

# Kiểm tra file nào tham chiếu đến dịch vụ từ thư mục tts/
grep -r "require.*tts\/ttsService" server/
```

## Kết luận

Các cải tiến ngắn hạn và trung hạn đã được thực hiện đầy đủ, làm rõ cấu trúc dịch vụ và giúp cải thiện khả năng bảo trì. Cải tiến dài hạn cần được lên kế hoạch và triển khai trong các giai đoạn tiếp theo để đạt được kiến trúc dịch vụ tối ưu và nhất quán.

## Lịch sử cập nhật

- **05/23/2025**: 
  - Hoàn thành việc xóa bỏ các thư mục trùng lặp `tts/` và `translation/`
  - Cập nhật ttsServiceOptimized.js với thông tin về phiên bản tối ưu hóa
  - Hoàn thiện tài liệu hướng dẫn về cấu trúc dịch vụ
  - Xác nhận tất cả các imports trong socket handlers đã được cập nhật
- **05/22/2025**: 
  - Thêm các file README và cảnh báo vào các file trùng lặp
  - Chuyển đổi tài liệu từ README.txt sang README.md
- **05/20/2025**: 
  - Phân tích ban đầu về cấu trúc dịch vụ và xác định các vấn đề
  - Tạo kế hoạch chuẩn hóa

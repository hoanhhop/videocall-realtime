# Script để chuyển đổi mô hình PhoWhisper từ định dạng PyTorch sang CTranslate2
# và khởi động lại dịch vụ

# Cấu hình đường dẫn
$SOURCE_MODEL_DIR = "models/phowhisper/PhoWhisper-base"
$OUTPUT_MODEL_DIR = "models/phowhisper/PhoWhisper-base-ct2"

# Dừng dịch vụ hiện tại nếu đang chạy
Write-Host "Đang dừng dịch vụ Docker hiện có..." -ForegroundColor Yellow
docker-compose down

# Tạo thư mục đầu ra nếu chưa tồn tại
Write-Host "Tạo thư mục đầu ra cho mô hình CTranslate2..." -ForegroundColor Yellow
if (-not (Test-Path -Path $OUTPUT_MODEL_DIR)) {
    New-Item -Path $OUTPUT_MODEL_DIR -ItemType Directory -Force
}

# Cài đặt các gói Python cần thiết cho việc chuyển đổi
Write-Host "Cài đặt các gói Python cần thiết..." -ForegroundColor Yellow
pip install -r convert_requirements.txt

# Chuyển đổi mô hình
Write-Host "Bắt đầu chuyển đổi mô hình..." -ForegroundColor Cyan
python convert_model.py --source $SOURCE_MODEL_DIR --output $OUTPUT_MODEL_DIR --quantization "int8"

# Kiểm tra xem việc chuyển đổi có thành công không
if (-not (Test-Path -Path "$OUTPUT_MODEL_DIR/model.bin")) {
    Write-Host "Chuyển đổi mô hình thất bại! Không tìm thấy model.bin trong thư mục đầu ra." -ForegroundColor Red
    exit 1
}

# Cập nhật docker-compose.yml để sử dụng mô hình mới
Write-Host "Cập nhật docker-compose.yml..." -ForegroundColor Yellow
(Get-Content docker-compose.yml) -replace 'MODEL_PATH=/app/models/phowhisper/PhoWhisper-base', 'MODEL_PATH=/app/models/phowhisper/PhoWhisper-base-ct2' | Set-Content docker-compose.yml

# Khởi động lại dịch vụ
Write-Host "Khởi động lại dịch vụ với mô hình mới..." -ForegroundColor Green
docker-compose up -d

# Kiểm tra trạng thái dịch vụ
Start-Sleep -Seconds 10
Write-Host "Kiểm tra trạng thái dịch vụ:" -ForegroundColor Cyan
docker-compose ps

# Kiểm tra log
Write-Host "Log của dịch vụ PhoWhisper ASR:" -ForegroundColor Cyan
docker-compose logs phowhisper-asr-service --tail 20

Write-Host "Hoàn tất!" -ForegroundColor Green 
# Script PowerShell để chạy quá trình chuyển đổi
Write-Host "Bắt đầu quá trình chuyển đổi XTTS sang ONNX..."

# Nhận đường dẫn hiện tại
$currentDir = Get-Location
Write-Host "Thư mục hiện tại: $currentDir"

# Kiểm tra thư viện TTS
python -c "try: import TTS; print('TTS is installed'); except: print('TTS not installed')"

# Tắt chế độ in tiến trình và chạy script chuyển đổi
$ErrorActionPreference = 'Continue'
$VerbosePreference = 'Continue'

# Chạy script Python cải tiến
Write-Host "Chạy script chuyển đổi..."
python scripts/utils/convert_xtts_improved.py

# Kiểm tra xem có file ONNX nào được tạo không
$onnxDir = "server\models\tts\XTTS-v2\onnx"
Write-Host "Kiểm tra các file trong thư mục $onnxDir:"
Get-ChildItem -Path $onnxDir -Filter *.onnx | ForEach-Object {
    $fileSizeMB = [math]::Round(($_.Length / 1MB), 2)
    Write-Host "$($_.Name) - $fileSizeMB MB"
}

Write-Host "Hoàn thành kiểm tra."

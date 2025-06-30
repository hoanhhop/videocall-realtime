# check_service_structure.ps1
# Script để kiểm tra cấu trúc dịch vụ và độc tài liệu

Write-Host "====== KIỂM TRA CẤU TRÚC DỊCH VỤ ======" -ForegroundColor Cyan
Write-Host

Write-Host ">> Kiểm tra tài liệu:" -ForegroundColor Yellow
$docs = @(
    "server\services\README.md", 
    "server\services\tts_service\README.md", 
    "server\services\translation_service\README.md", 
    "docs\service-structure-guidelines.md"
)

foreach ($doc in $docs) {
    if (Test-Path $doc) {
        Write-Host "✅ $doc`: OK" -ForegroundColor Green
    } else {
        Write-Host "❌ $doc`: Thiếu" -ForegroundColor Red
    }
}
Write-Host

Write-Host ">> Kiểm tra cảnh báo trùng lặp:" -ForegroundColor Yellow
$deprecated = @(
    "server\services\tts\DEPRECATED.md",
    "server\services\translation\DEPRECATED.md"
)

foreach ($dep in $deprecated) {
    if (Test-Path $dep) {
        Write-Host "✅ $dep`: OK" -ForegroundColor Green
    } else {
        Write-Host "❌ $dep`: Thiếu" -ForegroundColor Red
    }
}
Write-Host

Write-Host ">> Kiểm tra imports trong socket:" -ForegroundColor Yellow
$ttsImports = Select-String -Path "server\socket\*.js" -Pattern "require.*ttsService"
$translationImports = Select-String -Path "server\socket\*.js" -Pattern "require.*translationService"

Write-Host "TTS Service imports:" -ForegroundColor Cyan
$ttsImports | ForEach-Object { Write-Host $_.Path $_.LineNumber ": " $_.Line }

Write-Host "Translation Service imports:" -ForegroundColor Cyan
$translationImports | ForEach-Object { Write-Host $_.Path $_.LineNumber ": " $_.Line }
Write-Host

Write-Host ">> Kiểm tra logger tùy chỉnh:" -ForegroundColor Yellow
$ttsLoggers = Select-String -Path "server\services\ttsService.js" -Pattern "createLogger.*tts"
$ttsDupLoggers = Select-String -Path "server\services\tts\ttsService.js" -Pattern "createLogger.*tts"
$translationLoggers = Select-String -Path "server\services\translationService.js" -Pattern "createLogger.*translation"
$translationDupLoggers = Select-String -Path "server\services\translation\translationService.js" -Pattern "createLogger.*translation"

Write-Host "TTS Loggers:" -ForegroundColor Cyan
$ttsLoggers | ForEach-Object { Write-Host $_.Path $_.LineNumber ": " $_.Line }
$ttsDupLoggers | ForEach-Object { Write-Host $_.Path $_.LineNumber ": " $_.Line }

Write-Host "Translation Loggers:" -ForegroundColor Cyan
$translationLoggers | ForEach-Object { Write-Host $_.Path $_.LineNumber ": " $_.Line }
$translationDupLoggers | ForEach-Object { Write-Host $_.Path $_.LineNumber ": " $_.Line }
Write-Host

Write-Host ">> Dịch vụ trong docker-compose.yml:" -ForegroundColor Yellow
$dockerCompose = Get-Content "docker-compose.yml" -Raw
$ttsService = ([regex]::Match($dockerCompose, "tts:[\s\S]*?(?=\w+:)")).Value
$translationService = ([regex]::Match($dockerCompose, "translation:[\s\S]*?(?=\w+:)")).Value

Write-Host "TTS Service:" -ForegroundColor Cyan
Write-Host $ttsService

Write-Host "Translation Service:" -ForegroundColor Cyan
Write-Host $translationService
Write-Host

Write-Host "====== HOÀN THÀNH ======" -ForegroundColor Cyan

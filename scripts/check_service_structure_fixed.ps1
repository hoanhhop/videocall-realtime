# check_service_structure.ps1
# Script to check service structure and documentation

Write-Host "====== SERVICE STRUCTURE CHECK ======" -ForegroundColor Cyan
Write-Host

Write-Host ">> Documentation check:" -ForegroundColor Yellow
$docs = @(
    "server\services\README.md", 
    "server\services\tts_service\README.md", 
    "server\services\translation_service\README.md", 
    "docs\service-structure-guidelines.md"
)

foreach ($doc in $docs) {
    if (Test-Path $doc) {
        Write-Host "[OK] $doc" -ForegroundColor Green
    } else {
        Write-Host "[MISSING] $doc" -ForegroundColor Red
    }
}
Write-Host

Write-Host ">> Checking for duplicate directories:" -ForegroundColor Yellow
$duplicateDirs = @(
    "server\services\tts",
    "server\services\translation"
)

foreach ($dir in $duplicateDirs) {
    if (Test-Path $dir) {
        Write-Host "[WARNING] Directory still exists: $dir" -ForegroundColor Yellow
    } else {
        Write-Host "[OK] Directory removed: $dir" -ForegroundColor Green
    }
}
Write-Host

Write-Host ">> Socket imports check:" -ForegroundColor Yellow
$ttsImports = Select-String -Path "server\socket\*.js" -Pattern "require.*ttsService"
$translationImports = Select-String -Path "server\socket\*.js" -Pattern "require.*translationService"

Write-Host "TTS Service imports:" -ForegroundColor Cyan
$ttsImports | ForEach-Object { Write-Host $_.Path $_.LineNumber ": " $_.Line }

Write-Host "Translation Service imports:" -ForegroundColor Cyan
$translationImports | ForEach-Object { Write-Host $_.Path $_.LineNumber ": " $_.Line }
Write-Host

Write-Host ">> Custom logger check:" -ForegroundColor Yellow
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

Write-Host ">> Services in docker-compose.yml:" -ForegroundColor Yellow
$dockerCompose = Get-Content "docker-compose.yml" -Raw
$ttsService = ([regex]::Match($dockerCompose, "tts:[\s\S]*?(?=\w+:)")).Value
$translationService = ([regex]::Match($dockerCompose, "translation:[\s\S]*?(?=\w+:)")).Value

Write-Host "TTS Service:" -ForegroundColor Cyan
Write-Host $ttsService

Write-Host "Translation Service:" -ForegroundColor Cyan
Write-Host $translationService
Write-Host

Write-Host "====== COMPLETED ======" -ForegroundColor Cyan

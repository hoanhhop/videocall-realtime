# verify_imports.ps1 - Script to verify all imports use the correct paths

Write-Host "=== CHECKING SERVICE IMPORTS ===" -ForegroundColor Cyan
Write-Host

# Check that all imports use the standardized paths
Write-Host ">> Checking TTS imports:" -ForegroundColor Yellow
$ttsImports = Select-String -Path "server\**\*.js" -Pattern "require.*ttsService" | Where-Object { $_.Line -notmatch "services/ttsService" -and $_.Line -notmatch "services\\ttsService" }
$ttsImports | ForEach-Object { Write-Host $_.Path $_.LineNumber ": " $_.Line }
Write-Host

Write-Host ">> Checking Translation imports:" -ForegroundColor Yellow
$translationImports = Select-String -Path "server\**\*.js" -Pattern "require.*translationService" | Where-Object { $_.Line -notmatch "services/translationService" -and $_.Line -notmatch "services\\translationService" }
$translationImports | ForEach-Object { Write-Host $_.Path $_.LineNumber ": " $_.Line }
Write-Host

# Check that all socket handlers use the correct imports
Write-Host ">> Checking socket controllers imports:" -ForegroundColor Yellow
$socketImports = Select-String -Path "server\socket\*.js" -Pattern "require.*services"
$socketImports | ForEach-Object { Write-Host $_.Path $_.LineNumber ": " $_.Line }
Write-Host

Write-Host ">> Checking API controllers imports:" -ForegroundColor Yellow
$controllerImports = Select-String -Path "server\controllers\*.js" -Pattern "require.*services"
$controllerImports | ForEach-Object { Write-Host $_.Path $_.LineNumber ": " $_.Line }
Write-Host

Write-Host "=== CHECKING DOCKER CONFIGURATION ===" -ForegroundColor Cyan
Write-Host

Write-Host ">> Checking docker-compose.yml service paths:" -ForegroundColor Yellow
$dockerComposeContent = Get-Content "docker-compose.yml" -Raw
$contextMatches = [regex]::Matches($dockerComposeContent, "context:.*?services/.*?$", [System.Text.RegularExpressions.RegexOptions]::Multiline)
$contextMatches | ForEach-Object { Write-Host $_.Value }
Write-Host

Write-Host "=== VERIFICATION COMPLETE ===" -ForegroundColor Cyan

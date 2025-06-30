# Debug API Server Script
Write-Host "=== API SERVER DEBUG SCRIPT ===" -ForegroundColor Green

# 1. Upload debug file to server
Write-Host "`n1. Uploading debug file..." -ForegroundColor Yellow
scp "e:\video-call-translation_OFFICIAL\server\api\debug-server.js" "hopboy553@34.142.175.163:/home/hopboy553/video-call-translation_OFFICIAL/server/api/"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Debug file uploaded successfully" -ForegroundColor Green
} else {
    Write-Host "✗ Failed to upload debug file" -ForegroundColor Red
    exit 1
}

# 2. Run debug script in API container
Write-Host "`n2. Running debug script in container..." -ForegroundColor Yellow
$debugCommand = "cd /home/hopboy553/video-call-translation_OFFICIAL; docker compose -f docker-compose.production.yml exec api node api/debug-server.js"

ssh hopboy553@34.142.175.163 $debugCommand

Write-Host "`n3. If debug shows errors, let's try interactive container..." -ForegroundColor Yellow
$interactiveCommand = "cd /home/hopboy553/video-call-translation_OFFICIAL; docker compose -f docker-compose.production.yml exec api /bin/bash"

Write-Host "Run this command to enter interactive mode:" -ForegroundColor Cyan
Write-Host "ssh hopboy553@34.142.175.163 `"$interactiveCommand`"" -ForegroundColor White

Write-Host "`n=== DEBUG SCRIPT COMPLETE ===" -ForegroundColor Green

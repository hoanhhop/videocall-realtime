# Debug API Server Script
Write-Host "=== API SERVER DEBUG SCRIPT ===" -ForegroundColor Green

# 1. Upload debug file to server
Write-Host "1. Uploading debug file..." -ForegroundColor Yellow
scp "e:\video-call-translation_OFFICIAL\server\api\debug-server.js" "hopboy553@34.142.175.163:/home/hopboy553/video-call-translation_OFFICIAL/server/api/"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Debug file uploaded successfully" -ForegroundColor Green
} else {
    Write-Host "Failed to upload debug file" -ForegroundColor Red
    exit 1
}

# 2. Run debug script in API container
Write-Host "2. Running debug script in container..." -ForegroundColor Yellow
ssh hopboy553@34.142.175.163 "cd /home/hopboy553/video-call-translation_OFFICIAL; docker compose -f docker-compose.production.yml exec api node api/debug-server.js"

Write-Host "=== DEBUG SCRIPT COMPLETE ===" -ForegroundColor Green

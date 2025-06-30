#!/usr/bin/env powershell
# Deploy and Test Script for Video Call Translation

Write-Host "=== Video Call Translation Deploy Test ===" -ForegroundColor Green

# Kiểm tra Docker có chạy không
Write-Host "Checking Docker status..." -ForegroundColor Yellow
try {
    docker --version
    if ($LASTEXITCODE -ne 0) {
        throw "Docker not running"
    }
} catch {
    Write-Host "Error: Docker is not running or not installed" -ForegroundColor Red
    exit 1
}

# Dừng tất cả containers cũ
Write-Host "Stopping existing containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.production.yml down --remove-orphans

# Dọn dẹp images cũ (optional)
$cleanup = Read-Host "Do you want to cleanup old images? (y/N)"
if ($cleanup -eq "y" -or $cleanup -eq "Y") {
    Write-Host "Cleaning up old images..." -ForegroundColor Yellow
    docker system prune -f
}

# Build từng service một để dễ debug
Write-Host "Building services step by step..." -ForegroundColor Yellow

Write-Host "1. Building Redis..." -ForegroundColor Cyan
docker-compose -f docker-compose.production.yml pull redis

Write-Host "2. Building API service..." -ForegroundColor Cyan
docker-compose -f docker-compose.production.yml build --no-cache api
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error building API service" -ForegroundColor Red
    exit 1
}

Write-Host "3. Building Socket service..." -ForegroundColor Cyan
docker-compose -f docker-compose.production.yml build --no-cache socket
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error building Socket service" -ForegroundColor Red
    exit 1
}

Write-Host "4. Building Client service..." -ForegroundColor Cyan
docker-compose -f docker-compose.production.yml build --no-cache client
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error building Client service" -ForegroundColor Red
    exit 1
}

Write-Host "5. Building PhoWhisper service..." -ForegroundColor Cyan
docker-compose -f docker-compose.production.yml build --no-cache phowhisper
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error building PhoWhisper service" -ForegroundColor Red
    exit 1
}

Write-Host "6. Building Translation service..." -ForegroundColor Cyan
docker-compose -f docker-compose.production.yml build --no-cache translation
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error building Translation service" -ForegroundColor Red
    exit 1
}

Write-Host "7. Building TTS service..." -ForegroundColor Cyan
docker-compose -f docker-compose.production.yml build --no-cache tts
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error building TTS service" -ForegroundColor Red
    exit 1
}

# Khởi động services theo thứ tự
Write-Host "Starting services in order..." -ForegroundColor Green

Write-Host "Starting Traefik..." -ForegroundColor Cyan
docker-compose -f docker-compose.production.yml up -d traefik
Start-Sleep 5

Write-Host "Starting Redis..." -ForegroundColor Cyan
docker-compose -f docker-compose.production.yml up -d redis
Start-Sleep 10

Write-Host "Starting AI Services..." -ForegroundColor Cyan
docker-compose -f docker-compose.production.yml up -d phowhisper translation tts
Start-Sleep 30

Write-Host "Starting API and Socket servers..." -ForegroundColor Cyan
docker-compose -f docker-compose.production.yml up -d api socket
Start-Sleep 15

Write-Host "Starting Client..." -ForegroundColor Cyan
docker-compose -f docker-compose.production.yml up -d client

# Kiểm tra trạng thái
Write-Host "Checking service status..." -ForegroundColor Yellow
docker-compose -f docker-compose.production.yml ps

# Kiểm tra logs
Write-Host "Checking recent logs..." -ForegroundColor Yellow
docker-compose -f docker-compose.production.yml logs --tail=20

Write-Host "=== Deployment Complete ===" -ForegroundColor Green
Write-Host "Access the application at: http://34.126.167.181" -ForegroundColor Yellow
Write-Host "Traefik Dashboard: http://34.126.167.181:8080/dashboard/" -ForegroundColor Yellow
Write-Host ""
Write-Host "To check logs: docker-compose -f docker-compose.production.yml logs -f [service_name]" -ForegroundColor Cyan
Write-Host "To restart a service: docker-compose -f docker-compose.production.yml restart [service_name]" -ForegroundColor Cyan

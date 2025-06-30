#!/usr/bin/env powershell
# Quick Health Check Script

Write-Host "=== Quick Health Check ===" -ForegroundColor Green

# Kiểm tra Docker containers
Write-Host "Checking container status..." -ForegroundColor Yellow
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

Write-Host "`n=== Service Health Checks ===" -ForegroundColor Green

# Kiểm tra từng service
$services = @("traefik", "redis", "api", "socket", "phowhisper", "translation", "tts", "client")

foreach ($service in $services) {
    Write-Host "Checking $service..." -ForegroundColor Cyan
    $status = docker-compose -f docker-compose.production.yml ps $service --format json | ConvertFrom-Json
    if ($status) {
        Write-Host "  $service: $($status.State)" -ForegroundColor Green
    } else {
        Write-Host "  $service: NOT FOUND" -ForegroundColor Red
    }
}

Write-Host "`n=== Recent Error Logs ===" -ForegroundColor Yellow
docker-compose -f docker-compose.production.yml logs --tail=50 | Select-String -Pattern "error|Error|ERROR|exception|Exception|EXCEPTION|failed|Failed|FAILED" | Select-Object -Last 10

Write-Host "`n=== Resource Usage ===" -ForegroundColor Yellow
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"

Write-Host "`n=== Network Test ===" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://34.126.167.181" -TimeoutSec 10 -UseBasicParsing
    Write-Host "Website accessible: HTTP $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "Website not accessible: $($_.Exception.Message)" -ForegroundColor Red
}

try {
    $response = Invoke-WebRequest -Uri "http://34.126.167.181:8080/dashboard/" -TimeoutSec 10 -UseBasicParsing
    Write-Host "Traefik dashboard accessible: HTTP $($response.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "Traefik dashboard not accessible: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n=== Quick Commands ===" -ForegroundColor Cyan
Write-Host "View logs: docker-compose -f docker-compose.production.yml logs -f [service]"
Write-Host "Restart service: docker-compose -f docker-compose.production.yml restart [service]"
Write-Host "Scale service: docker-compose -f docker-compose.production.yml up -d --scale [service]=2"
Write-Host "Stop all: docker-compose -f docker-compose.production.yml down"

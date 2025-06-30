#!/usr/bin/env powershell
# Upload and Deploy Script

param(
    [string]$VMHost = "34.126.167.181",
    [string]$VMUser = "hopboy553",
    [string]$RemotePath = "/home/hopboy553/video-call-translation_OFFICIAL"
)

Write-Host "=== Upload and Deploy to VM ===" -ForegroundColor Green

# Kiểm tra files quan trọng
$requiredFiles = @(
    "docker-compose.production.yml",
    "server/Dockerfile.api",
    "server/Dockerfile.socket",
    "server/package.json"
)

foreach ($file in $requiredFiles) {
    if (!(Test-Path $file)) {
        Write-Host "Error: Required file not found: $file" -ForegroundColor Red
        exit 1
    }
}

Write-Host "All required files found." -ForegroundColor Green

# Upload files quan trọng
Write-Host "Uploading files to VM..." -ForegroundColor Yellow

$filesToUpload = @(
    "docker-compose.production.yml",
    "server/Dockerfile.api",
    "server/Dockerfile.socket"
)

foreach ($file in $filesToUpload) {
    Write-Host "Uploading $file..." -ForegroundColor Cyan
    $remoteDir = Split-Path "$RemotePath/$file" -Parent
    
    # Tạo thư mục nếu chưa có
    ssh "${VMUser}@${VMHost}" "mkdir -p '$remoteDir'"
    
    # Upload file
    scp "$file" "${VMUser}@${VMHost}:$RemotePath/$file"
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Error uploading $file" -ForegroundColor Red
        exit 1
    }
}

# Upload deploy script
Write-Host "Uploading deploy scripts..." -ForegroundColor Cyan
scp "DEPLOY-README.md" "${VMUser}@${VMHost}:$RemotePath/"

# Chạy deploy trên VM
Write-Host "Running deployment on VM..." -ForegroundColor Yellow

$deployCommands = @"
cd $RemotePath
echo "=== VM Deployment Started ==="
echo "Current directory: \$(pwd)"
echo "Files in directory:"
ls -la

echo "Stopping existing containers..."
docker-compose -f docker-compose.production.yml down --remove-orphans

echo "Building new images..."
docker-compose -f docker-compose.production.yml build --no-cache

echo "Starting services..."
docker-compose -f docker-compose.production.yml up -d

echo "Waiting for services to start..."
sleep 30

echo "Checking service status..."
docker-compose -f docker-compose.production.yml ps

echo "Checking recent logs..."
docker-compose -f docker-compose.production.yml logs --tail=20

echo "=== Deployment Complete ==="
echo "Application URL: http://$VMHost"
echo "Traefik Dashboard: http://${VMHost}:8080/dashboard/"
"@

ssh "${VMUser}@${VMHost}" "$deployCommands"

if ($LASTEXITCODE -eq 0) {
    Write-Host "=== Deployment Successful ===" -ForegroundColor Green
    Write-Host "Application: http://$VMHost" -ForegroundColor Yellow
    Write-Host "Dashboard: http://${VMHost}:8080/dashboard/" -ForegroundColor Yellow
} else {
    Write-Host "=== Deployment Failed ===" -ForegroundColor Red
    Write-Host "Check VM logs with: ssh $VMUser@$VMHost 'cd $RemotePath && docker-compose -f docker-compose.production.yml logs'" -ForegroundColor Yellow
}

Write-Host "`nNext steps if needed:" -ForegroundColor Cyan
Write-Host "1. SSH to VM: ssh $VMUser@$VMHost" -ForegroundColor White
Write-Host "2. Check logs: docker-compose -f docker-compose.production.yml logs -f [service]" -ForegroundColor White
Write-Host "3. Restart service: docker-compose -f docker-compose.production.yml restart [service]" -ForegroundColor White

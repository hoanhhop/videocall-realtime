#!/usr/bin/env powershell
# VM Direct Deploy Script for video-call-translation
# VM Config: c2d-standard-8 (8 vCPUs, 32GB RAM, No GPU)

param(
    [string]$VMHost = "34.126.167.181",
    [string]$VMUser = "hopboy553",
    [string]$RemotePath = "/home/hopboy553/video-call-translation_OFFICIAL"
)

Write-Host "=== VM Direct Deployment ===" -ForegroundColor Green
Write-Host "VM: $VMUser@$VMHost" -ForegroundColor Yellow
Write-Host "Path: $RemotePath" -ForegroundColor Yellow

# Tạo comprehensive deploy script cho VM
$vmDeployScript = @"
#!/bin/bash
set -e

echo "=== Starting VM Deployment ==="
echo "VM Config: c2d-standard-8 (8 vCPUs, 32GB RAM, No GPU)"
echo "Current user: \$(whoami)"
echo "Current directory: \$(pwd)"
echo "Available memory: \$(free -h)"
echo "Available disk: \$(df -h /)"

# Navigate to project directory
cd $RemotePath

echo "=== Checking Docker installation ==="
if ! command -v docker &> /dev/null; then
    echo "Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker \$USER
    echo "Docker installed. Please logout and login again, then re-run this script."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "Installing Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-\$(uname -s)-\$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

echo "Docker version: \$(docker --version)"
echo "Docker Compose version: \$(docker-compose --version)"

# Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

echo "=== Checking project files ==="
ls -la
if [ ! -f "docker-compose.production.yml" ]; then
    echo "ERROR: docker-compose.production.yml not found!"
    exit 1
fi

echo "=== Stopping existing containers ==="
docker-compose -f docker-compose.production.yml down --remove-orphans || true

echo "=== Cleaning old images (if any) ==="
docker system prune -f || true

echo "=== Setting up for CPU-only mode ==="
# Check if we need to modify docker-compose for CPU optimization
if ! grep -q "USE_CUDA=false" docker-compose.production.yml; then
    echo "Docker compose already configured for CPU mode"
fi

echo "=== Building services for CPU mode ==="
echo "Building Traefik (pulling from registry)..."
docker-compose -f docker-compose.production.yml pull traefik

echo "Building Redis (pulling from registry)..."
docker-compose -f docker-compose.production.yml pull redis

echo "Building API service..."
docker-compose -f docker-compose.production.yml build --no-cache api

echo "Building Socket service..."
docker-compose -f docker-compose.production.yml build --no-cache socket

echo "Building Client service..."
docker-compose -f docker-compose.production.yml build --no-cache client

echo "Building PhoWhisper service (CPU optimized)..."
docker-compose -f docker-compose.production.yml build --no-cache phowhisper

echo "Building Translation service (CPU optimized)..."
docker-compose -f docker-compose.production.yml build --no-cache translation

echo "Building TTS service (CPU optimized)..."
docker-compose -f docker-compose.production.yml build --no-cache tts

echo "=== Starting services in proper order ==="

echo "Step 1: Starting infrastructure services..."
docker-compose -f docker-compose.production.yml up -d traefik redis
sleep 10

echo "Step 2: Starting AI services (this may take a while)..."
docker-compose -f docker-compose.production.yml up -d phowhisper translation tts
sleep 45

echo "Step 3: Starting application services..."
docker-compose -f docker-compose.production.yml up -d api socket
sleep 20

echo "Step 4: Starting frontend..."
docker-compose -f docker-compose.production.yml up -d client
sleep 10

echo "=== Deployment Status Check ==="
docker-compose -f docker-compose.production.yml ps

echo "=== Resource Usage ==="
docker stats --no-stream

echo "=== Service Health Check ==="
echo "Checking if services are responding..."

# Wait a bit more for services to fully start
sleep 30

# Check Traefik dashboard
echo "Testing Traefik dashboard..."
curl -f http://localhost:8080/dashboard/ || echo "Traefik dashboard not ready yet"

# Check if main site responds
echo "Testing main application..."
curl -f http://localhost/ || echo "Main application not ready yet"

echo "=== Recent Logs ==="
docker-compose -f docker-compose.production.yml logs --tail=20

echo "=== Deployment Complete ==="
echo "Access URLs:"
echo "  Main App: http://$VMHost"
echo "  Traefik Dashboard: http://$VMHost:8080/dashboard/"
echo ""
echo "To monitor:"
echo "  docker-compose -f docker-compose.production.yml logs -f [service_name]"
echo "  docker-compose -f docker-compose.production.yml ps"
echo "  docker stats"
echo ""
echo "Services may take a few more minutes to fully initialize, especially AI services."
"@

# Upload deploy script to VM
Write-Host "Creating deploy script on VM..." -ForegroundColor Cyan
$vmDeployScript | ssh "${VMUser}@${VMHost}" "cat > /tmp/vm-deploy.sh && chmod +x /tmp/vm-deploy.sh"

# Execute deployment
Write-Host "Executing deployment on VM..." -ForegroundColor Yellow
ssh "${VMUser}@${VMHost}" "/tmp/vm-deploy.sh"

if ($LASTEXITCODE -eq 0) {
    Write-Host "=== Deployment Successful! ===" -ForegroundColor Green
    Write-Host ""
    Write-Host "🌐 Application URLs:" -ForegroundColor Cyan
    Write-Host "   Main App: http://$VMHost" -ForegroundColor White
    Write-Host "   Traefik Dashboard: http://$VMHost:8080/dashboard/" -ForegroundColor White
    Write-Host ""
    Write-Host "📊 Monitoring Commands:" -ForegroundColor Cyan
    Write-Host "   ssh $VMUser@$VMHost 'cd $RemotePath && docker-compose -f docker-compose.production.yml logs -f'" -ForegroundColor White
    Write-Host "   ssh $VMUser@$VMHost 'cd $RemotePath && docker stats'" -ForegroundColor White
    Write-Host "   ssh $VMUser@$VMHost 'cd $RemotePath && docker-compose -f docker-compose.production.yml ps'" -ForegroundColor White
} else {
    Write-Host "=== Deployment Failed ===" -ForegroundColor Red
    Write-Host "Check logs with:" -ForegroundColor Yellow
    Write-Host "ssh $VMUser@$VMHost 'cd $RemotePath && docker-compose -f docker-compose.production.yml logs --tail=50'" -ForegroundColor White
}

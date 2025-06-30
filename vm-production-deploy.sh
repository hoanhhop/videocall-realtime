#!/bin/bash
# Production deployment script for VM c2d-standard-8
# Run this after SSH to hopboy553@34.126.167.181

echo "=== VM Production Deployment Started ==="
echo "VM Configuration: c2d-standard-8 (8 vCPUs, 32GB RAM, No GPU)"
echo "Current time: $(date)"

# Navigate to project directory
cd /home/hopboy553/video-call-translation_OFFICIAL
echo "Working directory: $(pwd)"

# Check current Git status
echo "=== Git Status ==="
git status --porcelain
git log --oneline -5

# Stop existing containers
echo "=== Stopping existing containers ==="
docker-compose -f docker-compose.production.yml down --remove-orphans

# Clean up if needed
echo "=== Cleaning up Docker resources ==="
docker system prune -f
docker builder prune -f

# Check disk space
echo "=== Checking disk space ==="
df -h

# Check memory
echo "=== Checking memory ==="
free -h

# Build services in order (to handle dependencies)
echo "=== Building Docker images ==="

echo "Building API service..."
docker-compose -f docker-compose.production.yml build --no-cache api
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to build API service"
    exit 1
fi

echo "Building Socket service..."
docker-compose -f docker-compose.production.yml build --no-cache socket
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to build Socket service"
    exit 1
fi

echo "Building Client service..."
docker-compose -f docker-compose.production.yml build --no-cache client
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to build Client service"
    exit 1
fi

echo "Building PhoWhisper service..."
docker-compose -f docker-compose.production.yml build --no-cache phowhisper
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to build PhoWhisper service"
    exit 1
fi

echo "Building Translation service..."
docker-compose -f docker-compose.production.yml build --no-cache translation
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to build Translation service"
    exit 1
fi

echo "Building TTS service..."
docker-compose -f docker-compose.production.yml build --no-cache tts
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to build TTS service"
    exit 1
fi

# Start services in proper order
echo "=== Starting services in order ==="

echo "Starting Traefik reverse proxy..."
docker-compose -f docker-compose.production.yml up -d traefik
sleep 10

echo "Starting Redis..."
docker-compose -f docker-compose.production.yml up -d redis
sleep 15

echo "Starting AI services (PhoWhisper, Translation, TTS)..."
docker-compose -f docker-compose.production.yml up -d phowhisper translation tts
sleep 45

echo "Starting API and Socket servers..."
docker-compose -f docker-compose.production.yml up -d api socket
sleep 20

echo "Starting Client application..."
docker-compose -f docker-compose.production.yml up -d client
sleep 10

# Check status
echo "=== Checking deployment status ==="
docker-compose -f docker-compose.production.yml ps

# Check logs for errors
echo "=== Checking for errors in logs ==="
docker-compose -f docker-compose.production.yml logs --tail=30 | grep -i error

# Health checks
echo "=== Running health checks ==="

# Test API endpoint
echo "Testing API health..."
curl -f http://localhost:3000/api/health 2>/dev/null && echo "API: OK" || echo "API: FAILED"

# Test Socket.IO
echo "Testing Socket.IO..."
curl -f http://localhost:4000/socket.io/ 2>/dev/null && echo "Socket.IO: OK" || echo "Socket.IO: FAILED"

# Test Traefik dashboard
echo "Testing Traefik dashboard..."
curl -f http://localhost:8080/dashboard/ 2>/dev/null && echo "Traefik: OK" || echo "Traefik: FAILED"

# Check external access
echo "Testing external access..."
curl -f http://34.126.167.181/ 2>/dev/null && echo "External access: OK" || echo "External access: FAILED"

# Resource usage
echo "=== Resource usage ==="
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Final status
echo "=== Deployment Summary ==="
echo "Application URL: http://34.126.167.181"
echo "Traefik Dashboard: http://34.126.167.181:8080/dashboard/"
echo "Deployment completed at: $(date)"

echo "=== Useful commands for monitoring ==="
echo "View all logs: docker-compose -f docker-compose.production.yml logs -f"
echo "View specific service: docker-compose -f docker-compose.production.yml logs -f [service]"
echo "Restart service: docker-compose -f docker-compose.production.yml restart [service]"
echo "Check status: docker-compose -f docker-compose.production.yml ps"
echo "Resource monitoring: docker stats"

echo "=== Production deployment completed ==="

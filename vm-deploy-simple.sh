#!/bin/bash
# VM Deploy Script - Simple Version
set -e

echo "=== Starting VM Deployment ==="
cd /home/hopboy553/video-call-translation_OFFICIAL

echo "Current directory: $(pwd)"
echo "Files available:"
ls -la docker-compose.production.yml server/Dockerfile.api server/Dockerfile.socket

echo "=== Stopping existing containers ==="
docker-compose -f docker-compose.production.yml down --remove-orphans || true

echo "=== Cleaning up old images ==="
docker system prune -f

echo "=== Building images (this may take 10-15 minutes) ==="
docker-compose -f docker-compose.production.yml build --no-cache

echo "=== Starting services ==="
docker-compose -f docker-compose.production.yml up -d

echo "=== Waiting for services to initialize ==="
sleep 60

echo "=== Checking service status ==="
docker-compose -f docker-compose.production.yml ps

echo "=== Checking recent logs ==="
docker-compose -f docker-compose.production.yml logs --tail=10

echo "=== Testing endpoints ==="
echo "Testing main app..."
curl -s -o /dev/null -w "Main App: %{http_code}\n" http://localhost || echo "Main App: Not accessible"

echo "Testing Traefik dashboard..."
curl -s -o /dev/null -w "Traefik: %{http_code}\n" http://localhost:8080/dashboard/ || echo "Traefik: Not accessible"

echo ""
echo "=== Deployment Complete ==="
echo "Application URL: http://34.126.167.181"
echo "Traefik Dashboard: http://34.126.167.181:8080/dashboard/"
echo ""
echo "To check logs: docker-compose -f docker-compose.production.yml logs -f [service_name]"
echo "Services: traefik, redis, api, socket, phowhisper, translation, tts, client"

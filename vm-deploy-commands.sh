# VM Deploy Commands - Manual Execution
# Copy and paste these commands one by one when SSH into the VM

# 1. Navigate to project directory
cd /home/hopboy553/video-call-translation_OFFICIAL

# 2. Check current status
pwd
ls -la

# 3. Check Docker installation
docker --version || echo "Docker not installed"
docker-compose --version || echo "Docker Compose not installed"

# 4. Install Docker if needed (run only if Docker not installed)
# curl -fsSL https://get.docker.com -o get-docker.sh
# sudo sh get-docker.sh
# sudo usermod -aG docker $USER

# 5. Install Docker Compose if needed (run only if Docker Compose not installed)
# sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
# sudo chmod +x /usr/local/bin/docker-compose

# 6. Start Docker service
sudo systemctl start docker
sudo systemctl enable docker

# 7. Check system resources
echo "=== System Resources ==="
free -h
df -h /

# 8. Stop existing containers
echo "=== Stopping existing containers ==="
docker-compose -f docker-compose.production.yml down --remove-orphans

# 9. Clean old images
echo "=== Cleaning old images ==="
docker system prune -f

# 10. Check docker-compose file
echo "=== Checking docker-compose file ==="
head -20 docker-compose.production.yml

# 11. Build services (one by one for easier debugging)
echo "=== Building API service ==="
docker-compose -f docker-compose.production.yml build --no-cache api

echo "=== Building Socket service ==="
docker-compose -f docker-compose.production.yml build --no-cache socket

echo "=== Building Client service ==="
docker-compose -f docker-compose.production.yml build --no-cache client

# 12. Pull infrastructure images
echo "=== Pulling infrastructure images ==="
docker-compose -f docker-compose.production.yml pull traefik redis

# 13. Build AI services (these might take longer)
echo "=== Building PhoWhisper service ==="
docker-compose -f docker-compose.production.yml build --no-cache phowhisper

echo "=== Building Translation service ==="
docker-compose -f docker-compose.production.yml build --no-cache translation

echo "=== Building TTS service ==="
docker-compose -f docker-compose.production.yml build --no-cache tts

# 14. Start services in order
echo "=== Starting infrastructure services ==="
docker-compose -f docker-compose.production.yml up -d traefik redis

# Wait for infrastructure
echo "Waiting for infrastructure to start..."
sleep 15

echo "=== Starting AI services ==="
docker-compose -f docker-compose.production.yml up -d phowhisper translation tts

# Wait for AI services
echo "Waiting for AI services to start..."
sleep 60

echo "=== Starting application services ==="
docker-compose -f docker-compose.production.yml up -d api socket

# Wait for app services
echo "Waiting for application services to start..."
sleep 30

echo "=== Starting client service ==="
docker-compose -f docker-compose.production.yml up -d client

# 15. Check status
echo "=== Deployment Status ==="
docker-compose -f docker-compose.production.yml ps

# 16. Check resource usage
echo "=== Resource Usage ==="
docker stats --no-stream

# 17. Check logs
echo "=== Recent Logs ==="
docker-compose -f docker-compose.production.yml logs --tail=20

# 18. Test connectivity
echo "=== Testing connectivity ==="
curl -I http://localhost:8080/dashboard/ || echo "Traefik dashboard not ready"
curl -I http://localhost/ || echo "Main app not ready"

echo "=== Deployment Complete ==="
echo "Access URLs:"
echo "  Main App: http://34.126.167.181"
echo "  Traefik Dashboard: http://34.126.167.181:8080/dashboard/"

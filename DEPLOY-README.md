# Production Deployment Guide

## Vấn đề đã được sửa

### 1. Dockerfile Issues
- **Dockerfile.api**: Sửa PORT từ 5000 -> 3000, loại bỏ CMD trùng lặp
- **Dockerfile.socket**: Sửa PORT từ 5001 -> 4000, sửa CMD từ "socket-server.js" -> "socket/server.js"

### 2. Docker Compose Issues
- Loại bỏ volume mounts trong production (security risk)
- Loại bỏ command override (đã có trong Dockerfile)
- Tăng resource limits cho API service (1G -> 2G)
- Thêm restart policies

### 3. Port Configuration
- API: 3000 (đã đồng bộ)
- Socket: 4000 (đã đồng bộ)
- Traefik: 80, 8080
- Redis: 6379

## Deploy Instructions

### Option 1: Manual Deploy trên VM
```bash
# SSH vào VM
ssh hopboy553@34.126.167.181

# Navigate to project
cd /path/to/video-call-translation_OFFICIAL

# Copy files mới từ local lên VM (sử dụng scp hoặc git pull)

# Run deploy script
./deploy-test.ps1
```

### Option 2: Deploy từ Windows (recommended)
```powershell
# 1. Upload code lên VM trước (git push và git pull trên VM)

# 2. SSH và chạy commands sau:
ssh hopboy553@34.126.167.181

# Trên VM:
cd video-call-translation_OFFICIAL
docker-compose -f docker-compose.production.yml down --remove-orphans
docker-compose -f docker-compose.production.yml build --no-cache
docker-compose -f docker-compose.production.yml up -d

# Check status
docker-compose -f docker-compose.production.yml ps
docker-compose -f docker-compose.production.yml logs --tail=50
```

## Quick Health Check

```bash
# Kiểm tra containers
docker ps

# Kiểm tra logs
docker-compose -f docker-compose.production.yml logs -f api
docker-compose -f docker-compose.production.yml logs -f socket
docker-compose -f docker-compose.production.yml logs -f phowhisper

# Test endpoints
curl http://34.126.167.181/api/health
curl http://34.126.167.181:8080/dashboard/
```

## Troubleshooting

### 1. Build Failures
```bash
# Clear build cache
docker builder prune -f

# Build individually to isolate issues
docker-compose -f docker-compose.production.yml build api
docker-compose -f docker-compose.production.yml build socket
```

### 2. Memory Issues
```bash
# Check system resources
free -h
df -h

# Reduce resource limits in docker-compose.production.yml nếu cần
```

### 3. Network Issues
```bash
# Check Traefik routes
curl http://34.126.167.181:8080/api/http/routers

# Check service connectivity
docker exec -it video-call-translation_official_api_1 curl http://redis:6379
```

### 4. Service Startup Order
Services phải start theo thứ tự:
1. Traefik, Redis
2. PhoWhisper, Translation, TTS (AI services)
3. API, Socket
4. Client

## Monitoring

### Real-time logs
```bash
# All services
docker-compose -f docker-compose.production.yml logs -f

# Specific service
docker-compose -f docker-compose.production.yml logs -f api

# Error-only logs
docker-compose -f docker-compose.production.yml logs | grep -i error
```

### Resource monitoring
```bash
# Container stats
docker stats

# System resources
htop
# or
top
```

## URLs sau khi deploy thành công

- **Main App**: http://34.126.167.181
- **API**: http://34.126.167.181/api
- **Socket.IO**: http://34.126.167.181/socket.io
- **Traefik Dashboard**: http://34.126.167.181:8080/dashboard/

## Emergency Commands

```bash
# Stop everything
docker-compose -f docker-compose.production.yml down

# Force restart
docker-compose -f docker-compose.production.yml down
docker-compose -f docker-compose.production.yml up -d --force-recreate

# Clean everything (careful!)
docker system prune -a -f
docker volume prune -f
```

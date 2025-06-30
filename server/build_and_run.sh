#!/bin/bash

# Dừng các container đang chạy
echo "Stopping existing containers..."
docker-compose down

# Xóa các container cũ (nếu cần)
echo "Removing old containers..."
docker system prune -f

# Build các container
echo "Building Docker containers..."
docker-compose build

# Khởi động hệ thống
echo "Starting system..."
docker-compose up -d

# Hiển thị logs
echo "Showing logs (Ctrl+C to stop viewing logs)..."
docker-compose logs -f 
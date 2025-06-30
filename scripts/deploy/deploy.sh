#!/bin/bash
# Script tri?n khai t? ð?ng cho Video Call Translation trên VM

set -e

# Thi?t l?p màu s?c
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===================================================${NC}"
echo -e "${BLUE}   Tri?n khai Video Call Translation lên VM   ${NC}"
echo -e "${BLUE}===================================================${NC}"

# 1. Ki?m tra và cài ð?t các ph?n m?m c?n thi?t
echo -e "${YELLOW}[1/6] Ki?m tra và cài ð?t ph?n m?m c?n thi?t...${NC}"

# C?p nh?t gói ph?n m?m
sudo apt update && sudo apt upgrade -y

# Cài ð?t các ph?n m?m c?n thi?t
sudo apt install -y git curl wget htop ufw

# Cài ð?t Docker n?u chýa có
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}Cài ð?t Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo -e "${GREEN}Ð? cài ð?t Docker thành công!${NC}"
else
    echo -e "${GREEN}Docker ð? ðý?c cài ð?t!${NC}"
fi

# Cài ð?t Docker Compose n?u chýa có
if ! command -v docker-compose &> /dev/null; then
    echo -e "${YELLOW}Cài ð?t Docker Compose...${NC}"
    sudo apt install -y docker-compose
    echo -e "${GREEN}Ð? cài ð?t Docker Compose thành công!${NC}"
else
    echo -e "${GREEN}Docker Compose ð? ðý?c cài ð?t!${NC}"
fi

# 2. Cài ð?t NVIDIA Container Toolkit (cho GPU)
echo -e "${YELLOW}[2/6] Cài ð?t NVIDIA Container Toolkit...${NC}"

# Ki?m tra GPU
if command -v nvidia-smi &> /dev/null; then
    echo -e "${GREEN}Ð? phát hi?n GPU NVIDIA. Cài ð?t NVIDIA Container Toolkit...${NC}"
    distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
    curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
    curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
    sudo apt update && sudo apt install -y nvidia-container-toolkit
    sudo systemctl restart docker
    echo -e "${GREEN}Ð? cài ð?t NVIDIA Container Toolkit thành công!${NC}"
else
    echo -e "${YELLOW}Không phát hi?n GPU NVIDIA. B? qua cài ð?t NVIDIA Container Toolkit.${NC}"
fi

# Detect GPU/CPU mode
if [ -z "$USE_CUDA" ]; then
  if command -v nvidia-smi &> /dev/null; then
    export USE_CUDA=true
    echo -e "${YELLOW}Phát hi?n GPU NVIDIA - s? ch?y t?i ýu GPU (USE_CUDA=true)${NC}"
  else
    export USE_CUDA=false
    echo -e "${YELLOW}Không phát hi?n GPU - s? ch?y t?i ýu CPU (USE_CUDA=false)${NC}"
  fi
else
  echo -e "${YELLOW}USE_CUDA ð? ðý?c set t? ngoài: $USE_CUDA${NC}"
fi

# Set USE_ONNX=false m?c ð?nh n?u chýa có
if [ -z "$USE_ONNX" ]; then
  export USE_ONNX=false
fi

# 3. C?u h?nh tý?ng l?a
echo -e "${YELLOW}[3/6] C?u h?nh tý?ng l?a...${NC}"

sudo ufw allow 22/tcp     # SSH
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS
sudo ufw allow 8081/tcp   # Traefik frontend
sudo ufw allow 8082/tcp   # Traefik dashboard
echo "y" | sudo ufw enable
echo -e "${GREEN}Ð? c?u h?nh tý?ng l?a thành công!${NC}"

# 4. T?o thý m?c cache và c?u h?nh
echo -e "${YELLOW}[4/7] T?o thý m?c cache...${NC}"

mkdir -p phowhisper-cache translation-cache tts-cache embeddings-cache

# T?o file .env n?u chýa có
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}T?o file .env t? env_config.txt...${NC}"
    cp env_config.txt .env
    sed -i "s/USE_CUDA=.*/USE_CUDA=$USE_CUDA/g" .env
    sed -i "s/USE_ONNX=.*/USE_ONNX=$USE_ONNX/g" .env
    # Ði?u ch?nh c?u h?nh cho production
    sed -i 's/NODE_ENV=.*/NODE_ENV=production/g' .env
    echo -e "${GREEN}Ð? t?o file .env thành công!${NC}"
else
    echo -e "${GREEN}File .env ð? t?n t?i!${NC}"
fi

# 5. Ki?m tra c?u trúc d?ch v? ð? chu?n hóa
echo -e "${YELLOW}[5/7] Ki?m tra c?u trúc d?ch v?...${NC}"

# Ki?m tra n?u script verify_imports.sh t?n t?i
if [ -f "scripts/verify_imports.sh" ]; then
    echo -e "${YELLOW}Ki?m tra imports và c?u trúc d?ch v?...${NC}"
    chmod +x scripts/verify_imports.sh
    scripts/verify_imports.sh
    echo -e "${GREEN}Ki?m tra c?u trúc d?ch v? thành công!${NC}"
else
    echo -e "${YELLOW}B? qua ki?m tra c?u trúc d?ch v? (script không t?m th?y)${NC}"
fi

# 6. L?a ch?n file docker-compose phù h?p
echo -e "${YELLOW}[6/7] L?a ch?n c?u h?nh Docker Compose...${NC}"

# Xác ð?nh file docker-compose phù h?p d?a vào USE_CUDA
if [ "$USE_CUDA" = true ]; then
    COMPOSE_FILE="docker-compose.yml"
    echo -e "${GREEN}S? d?ng c?u h?nh GPU: ${COMPOSE_FILE}${NC}"
else
    if [ -f "docker-compose.production.yml" ]; then
        COMPOSE_FILE="docker-compose.production.yml"
        echo -e "${GREEN}S? d?ng c?u h?nh CPU: ${COMPOSE_FILE}${NC}"
    else
        COMPOSE_FILE="docker-compose.yml"
        echo -e "${YELLOW}C?u h?nh CPU không t?m th?y, s? d?ng m?c ð?nh: ${COMPOSE_FILE}${NC}"
    fi
fi

# Tri?n khai v?i Docker Compose
echo -e "${YELLOW}Tri?n khai v?i Docker Compose (${COMPOSE_FILE})...${NC}"
USE_CUDA=$USE_CUDA USE_ONNX=$USE_ONNX docker-compose -f $COMPOSE_FILE down
USE_CUDA=$USE_CUDA USE_ONNX=$USE_ONNX docker-compose -f $COMPOSE_FILE up -d

echo -e "${GREEN}Ð? tri?n khai d?ch v? thành công!${NC}"

# 7. T?o service systemd ð? t? ð?ng kh?i ð?ng
echo -e "${YELLOW}[7/7] C?u h?nh t? ð?ng kh?i ð?ng...${NC}"

# Chu?n b? file service ð? lýu bi?n COMPOSE_FILE và các bi?n môi trý?ng khác
cat > /tmp/video-translation-docker.service << EOF
[Unit]
Description=Video Call Translation Docker Compose
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/opt/video-call-translation
Environment="USE_CUDA=$USE_CUDA"
Environment="USE_ONNX=$USE_ONNX"
ExecStart=docker-compose -f $COMPOSE_FILE up -d
ExecStop=docker-compose -f $COMPOSE_FILE down

[Install]
WantedBy=multi-user.target
EOF

sudo mv /tmp/video-translation-docker.service /etc/systemd/system/video-translation-docker.service

sudo systemctl daemon-reload
sudo systemctl enable video-translation-docker
echo -e "${GREEN}Ð? c?u h?nh t? ð?ng kh?i ð?ng thành công!${NC}"

# Ki?m tra tri?n khai
echo -e "${YELLOW}Ki?m tra tri?n khai...${NC}"
docker-compose -f $COMPOSE_FILE ps

# Xác nh?n các d?ch v? ðang ch?y
echo -e "${YELLOW}Ki?m tra tr?ng thái d?ch v?...${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}"

# Hi?n th? thông tin k?t n?i
PUBLIC_IP=$(curl -s ifconfig.me)
echo -e "${GREEN}===================================================${NC}"
echo -e "${GREEN}   Tri?n khai hoàn t?t! ${NC}"
echo -e "${GREEN}===================================================${NC}"
echo -e "${YELLOW}Frontend: http://$PUBLIC_IP:8081${NC}"
echo -e "${YELLOW}API: http://$PUBLIC_IP:8081/api${NC}"
echo -e "${YELLOW}Socket: http://$PUBLIC_IP:8081/socket.io${NC}"
echo -e "${YELLOW}Traefik Dashboard: http://$PUBLIC_IP:8082${NC}"
echo -e "${YELLOW}Ð? xem logs: docker-compose -f $COMPOSE_FILE logs -f${NC}"
echo -e "${YELLOW}Ð? ki?m tra c?u trúc d?ch v?: scripts/verify_imports.sh${NC}"

# Hi?n th? thông tin c?u h?nh
echo -e "${GREEN}===================================================${NC}"
echo -e "${GREEN}   Thông tin c?u h?nh   ${NC}"
echo -e "${GREEN}===================================================${NC}"
echo -e "${YELLOW}Docker Compose file: $COMPOSE_FILE${NC}"
echo -e "${YELLOW}GPU mode: $USE_CUDA${NC}"
echo -e "${YELLOW}ONNX mode: $USE_ONNX${NC}"
echo -e "${YELLOW}Working directory: /opt/video-call-translation${NC}"

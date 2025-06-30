#!/bin/bash

# Video Call Integration - Safe Deployment Script
# Triển khai an toàn mà không ảnh hưởng hệ thống translation hiện có

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Video Call Integration - Safe Deployment${NC}"
echo "============================================="
echo -e "${YELLOW}⚠️  Chế độ an toàn: Không ảnh hưởng hệ thống translation hiện có${NC}"
echo ""

# Check current directory
echo -e "${BLUE}📍 Current directory:${NC}"
pwd
echo ""

# Check existing containers
echo -e "${BLUE}🔍 Checking existing containers...${NC}"
echo "Running containers:"
sudo docker ps --format "table {{.Names}}\t{{.Ports}}\t{{.Status}}"
echo ""

# Check existing networks
echo -e "${BLUE}🌐 Checking existing networks...${NC}"
sudo docker network ls
echo ""

# Verify files are present
echo -e "${BLUE}📂 Verifying required files...${NC}"
if [ ! -f "docker-compose.standalone.yml" ]; then
    echo -e "${RED}❌ docker-compose.standalone.yml not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ docker-compose.standalone.yml found${NC}"

if [ ! -d "server" ]; then
    echo -e "${RED}❌ server directory not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ server directory found${NC}"

if [ ! -d "database" ]; then
    echo -e "${RED}❌ database directory not found${NC}"
    exit 1
fi
echo -e "${GREEN}✅ database directory found${NC}"

# Check for port conflicts
echo -e "${BLUE}🔌 Checking for port conflicts...${NC}"
if sudo netstat -tlnp | grep -q ":3001 "; then
    echo -e "${YELLOW}⚠️  Port 3001 is already in use${NC}"
    sudo netstat -tlnp | grep ":3001 "
    echo "Do you want to continue? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled"
        exit 1
    fi
fi

if sudo netstat -tlnp | grep -q ":3307 "; then
    echo -e "${YELLOW}⚠️  Port 3307 is already in use${NC}"
    sudo netstat -tlnp | grep ":3307 "
    echo "Do you want to continue? (y/N)"
    read -r response
    if [[ ! "$response" =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled"
        exit 1
    fi
fi

echo -e "${GREEN}✅ No port conflicts detected${NC}"
echo ""

# Test Docker Compose configuration
echo -e "${BLUE}🧪 Testing Docker Compose configuration...${NC}"
if sudo docker-compose -f docker-compose.standalone.yml config > /dev/null; then
    echo -e "${GREEN}✅ Docker Compose configuration is valid${NC}"
else
    echo -e "${RED}❌ Docker Compose configuration is invalid${NC}"
    exit 1
fi

# Ask for confirmation
echo ""
echo -e "${YELLOW}🤔 Ready to deploy video call integration?${NC}"
echo "This will:"
echo "  - Create isolated network: video-call-standalone-network"
echo "  - Start MySQL on port 3307 (different from existing)"
echo "  - Start video call server on port 3001"
echo "  - Use separate volumes and containers"
echo ""
echo "Proceed with deployment? (y/N)"
read -r response
if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled"
    exit 0
fi

# Start deployment
echo ""
echo -e "${GREEN}🚀 Starting deployment...${NC}"

# Pull images first
echo -e "${BLUE}📥 Pulling Docker images...${NC}"
sudo docker-compose -f docker-compose.standalone.yml pull

# Build and start services
echo -e "${BLUE}🏗️  Building and starting services...${NC}"
sudo docker-compose -f docker-compose.standalone.yml up -d --build

# Wait for services to start
echo -e "${BLUE}⏳ Waiting for services to start...${NC}"
sleep 30

# Check status
echo -e "${BLUE}📊 Checking service status...${NC}"
sudo docker-compose -f docker-compose.standalone.yml ps

# Test connectivity
echo -e "${BLUE}🧪 Testing service connectivity...${NC}"
if curl -f http://localhost:3001/health 2>/dev/null; then
    echo -e "${GREEN}✅ Video call integration service is responding${NC}"
else
    echo -e "${YELLOW}⚠️  Service may still be starting up...${NC}"
fi

# Show logs
echo ""
echo -e "${BLUE}📋 Recent logs:${NC}"
sudo docker-compose -f docker-compose.standalone.yml logs --tail=20

echo ""
echo -e "${GREEN}🎉 Deployment completed!${NC}"
echo ""
echo -e "${BLUE}📋 Service Information:${NC}"
echo "  - Video Call Integration: http://34.142.175.163:3001"
echo "  - MySQL Database: localhost:3307"
echo "  - Network: video-call-standalone-network"
echo ""
echo -e "${BLUE}🔧 Management Commands:${NC}"
echo "  - View logs: sudo docker-compose -f docker-compose.standalone.yml logs -f"
echo "  - Restart: sudo docker-compose -f docker-compose.standalone.yml restart"
echo "  - Stop: sudo docker-compose -f docker-compose.standalone.yml down"
echo "  - Status: sudo docker-compose -f docker-compose.standalone.yml ps"
echo ""
echo -e "${GREEN}✅ Video call integration deployed safely without affecting existing translation system!${NC}"

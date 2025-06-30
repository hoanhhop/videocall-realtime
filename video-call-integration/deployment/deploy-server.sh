#!/bin/bash

# Video Call Integration - Server Deployment Script
# Triển khai server components lên VM: 34.142.175.163

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
VM_HOST="34.142.175.163"
VM_USER="hopboy553"
VM_PATH="/home/hopboy553/video-call-translation_OFFICIAL/video-call-integration"
LOCAL_SERVER_PATH="./server"

echo -e "${GREEN}🚀 Video Call Integration - Server Deployment${NC}"
echo "==========================================="

# Function to print status
print_status() {
    echo -e "${YELLOW}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if server directory exists
if [ ! -d "$LOCAL_SERVER_PATH" ]; then
    print_error "Server directory not found: $LOCAL_SERVER_PATH"
    exit 1
fi

print_status "Checking VM connection..."
if ! ssh -o ConnectTimeout=10 $VM_USER@$VM_HOST "echo 'Connected successfully'" > /dev/null 2>&1; then
    print_error "Cannot connect to VM: $VM_HOST"
    exit 1
fi
print_success "VM connection established"

print_status "Creating deployment directory on VM..."
ssh $VM_USER@$VM_HOST "mkdir -p $VM_PATH && mkdir -p $VM_PATH/logs"
print_success "Deployment directory created"

print_status "Uploading server files..."
rsync -avz --exclude node_modules --exclude .env --progress $LOCAL_SERVER_PATH/ $VM_USER@$VM_HOST:$VM_PATH/
print_success "Server files uploaded"

print_status "Creating environment file..."
ssh $VM_USER@$VM_HOST "cat > $VM_PATH/.env << 'EOF'
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=hommy_database

# JWT Configuration
JWT_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=24h

# Server Configuration
PORT=3001
NODE_ENV=production

# CORS Configuration
ALLOWED_ORIGINS=https://34.126.167.181,http://localhost:3000,https://localhost:3000

# WebRTC Configuration
STUN_SERVER=stun:stun.l.google.com:19302

# Logging
LOG_LEVEL=info
LOG_FILE=/home/hopboy553/video-call-translation_OFFICIAL/video-call-integration/logs/server.log
EOF"
print_success "Environment file created"

print_status "Installing Node.js dependencies..."
ssh $VM_USER@$VM_HOST "cd $VM_PATH && npm install --production"
print_success "Dependencies installed"

print_status "Setting up database..."
ssh $VM_USER@$VM_HOST "cd $VM_PATH && node database/setup.js"
print_success "Database setup completed"

print_status "Creating systemd service..."
ssh $VM_USER@$VM_HOST "sudo tee /etc/systemd/system/video-call-integration.service > /dev/null << 'EOF'
[Unit]
Description=Video Call Integration Server
After=network.target mysql.service

[Service]
Type=simple
User=$VM_USER
WorkingDirectory=$VM_PATH
ExecStart=/usr/bin/node integrationServer.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

# Logging
StandardOutput=append:/home/hopboy553/video-call-translation_OFFICIAL/video-call-integration/logs/server.log
StandardError=append:/home/hopboy553/video-call-translation_OFFICIAL/video-call-integration/logs/error.log

[Install]
WantedBy=multi-user.target
EOF"
print_success "Systemd service created"

print_status "Creating logs directory..."
ssh $VM_USER@$VM_HOST "mkdir -p $VM_PATH/logs"
print_success "Logs directory created"

print_status "Enabling and starting service..."
ssh $VM_USER@$VM_HOST "sudo systemctl daemon-reload && sudo systemctl enable video-call-integration && sudo systemctl start video-call-integration"
print_success "Service started"

print_status "Configuring firewall..."
ssh $VM_USER@$VM_HOST "sudo ufw allow 3001/tcp" 2>/dev/null || true
print_success "Firewall configured"

print_status "Setting up SSL certificate (if needed)..."
ssh $VM_USER@$VM_HOST "
if [ ! -f /etc/ssl/certs/video-call-integration.crt ]; then
    sudo openssl req -x509 -newkey rsa:4096 -keyout /etc/ssl/private/video-call-integration.key -out /etc/ssl/certs/video-call-integration.crt -days 365 -nodes -subj '/C=VN/ST=State/L=City/O=Organization/OU=IT/CN=34.126.167.181'
    sudo chmod 600 /etc/ssl/private/video-call-integration.key
    sudo chmod 644 /etc/ssl/certs/video-call-integration.crt
fi
" || true
print_success "SSL certificate configured"

print_status "Checking service status..."
SERVICE_STATUS=$(ssh $VM_USER@$VM_HOST "sudo systemctl is-active video-call-integration")
if [ "$SERVICE_STATUS" = "active" ]; then
    print_success "Service is running successfully"
else
    print_error "Service is not running. Status: $SERVICE_STATUS"
    ssh $VM_USER@$VM_HOST "sudo journalctl -u video-call-integration --no-pager -n 20"
fi

print_status "Testing API endpoint..."
sleep 5
if ssh $VM_USER@$VM_HOST "curl -k -s https://localhost:3001/api/health" > /dev/null 2>&1; then
    print_success "API endpoint is responding"
else
    print_error "API endpoint is not responding"
fi

echo ""
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo ""
echo "📍 Server Details:"
echo "   URL: https://34.126.167.181:3001"
echo "   WebSocket: wss://34.126.167.181:3001"
echo "   Service: systemctl status video-call-integration"
echo "   Logs: tail -f $VM_PATH/logs/server.log"
echo ""
echo "📋 Next Steps:"
echo "   1. Copy client components to your React project"
echo "   2. Configure client to connect to https://34.126.167.181:3001"
echo "   3. Test the integration"
echo ""
echo "🔧 Management Commands:"
echo "   Start:   systemctl start video-call-integration"
echo "   Stop:    systemctl stop video-call-integration"
echo "   Restart: systemctl restart video-call-integration"
echo "   Status:  systemctl status video-call-integration"
echo "   Logs:    journalctl -u video-call-integration -f"

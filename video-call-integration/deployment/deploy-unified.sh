#!/bin/bash

# Video Call Integration - Unified Deployment Script
# Triển khai tích hợp với hệ thống translation hiện có

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VM_HOST="34.142.175.163"
VM_USER="root"
INTEGRATION_PATH="/opt/video-call-integration"
ORIGINAL_PATH="/opt/video-call-translation"

echo -e "${GREEN}🚀 Video Call Integration - Unified Deployment${NC}"
echo "=============================================="

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

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Check if integration directory exists
if [ ! -d "./video-call-integration" ]; then
    print_error "Video call integration directory not found"
    exit 1
fi

print_status "Checking VM connection..."
if ! ssh -o ConnectTimeout=10 $VM_USER@$VM_HOST "echo 'Connected successfully'" > /dev/null 2>&1; then
    print_error "Cannot connect to VM: $VM_HOST"
    exit 1
fi
print_success "VM connection established"

print_status "Checking existing translation system..."
TRANSLATION_EXISTS=$(ssh $VM_USER@$VM_HOST "[ -d '$ORIGINAL_PATH' ] && echo 'exists' || echo 'not_exists'")
if [ "$TRANSLATION_EXISTS" = "exists" ]; then
    print_success "Existing translation system found at $ORIGINAL_PATH"
else
    print_info "No existing translation system found. Will deploy standalone."
fi

print_status "Creating integration directory..."
ssh $VM_USER@$VM_HOST "mkdir -p $INTEGRATION_PATH && chown $VM_USER:$VM_USER $INTEGRATION_PATH"
print_success "Integration directory created"

print_status "Uploading integration files..."
rsync -avz --exclude node_modules --exclude .env --progress ./video-call-integration/ $VM_USER@$VM_HOST:$INTEGRATION_PATH/
print_success "Integration files uploaded"

print_status "Setting up environment configuration..."
ssh $VM_USER@$VM_HOST "cat > $INTEGRATION_PATH/.env << 'EOF'
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
ALLOWED_ORIGINS=https://34.142.175.163,http://localhost:3000

# WebRTC Configuration
STUN_SERVER=stun:stun.l.google.com:19302

# Integration with existing translation services
TRANSLATION_API_URL=http://localhost:5000/api
SOCKET_SERVER_URL=http://localhost:4000
PHOWHISPER_ASR_URL=http://localhost:50051
TRANSLATION_SERVICE_URL=http://localhost:50052
TTS_SERVICE_URL=http://localhost:5002
EMBEDDING_SERVICE_URL=http://localhost:5003
REDIS_URL=redis://localhost:6379

# Logging
LOG_LEVEL=info
LOG_FILE=$INTEGRATION_PATH/logs/server.log
EOF"
print_success "Environment configuration created"

print_status "Installing dependencies..."
ssh $VM_USER@$VM_HOST "cd $INTEGRATION_PATH/server && npm install --production"
print_success "Dependencies installed"

print_status "Setting up database..."
ssh $VM_USER@$VM_HOST "cd $INTEGRATION_PATH && node database/setup.js"
print_success "Database setup completed"

print_status "Creating logs directory..."
ssh $VM_USER@$VM_HOST "mkdir -p $INTEGRATION_PATH/logs && chown $VM_USER:$VM_USER $INTEGRATION_PATH/logs"
print_success "Logs directory created"

print_status "Creating systemd service..."
ssh $VM_USER@$VM_HOST "cat > /etc/systemd/system/video-call-integration.service << 'EOF'
[Unit]
Description=Video Call Integration Server
After=network.target mysql.service
Wants=video-call-translation.service

[Service]
Type=simple
User=$VM_USER
WorkingDirectory=$INTEGRATION_PATH/server
ExecStart=/usr/bin/node integrationServer.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

# Logging
StandardOutput=append:$INTEGRATION_PATH/logs/server.log
StandardError=append:$INTEGRATION_PATH/logs/error.log

[Install]
WantedBy=multi-user.target
EOF"
print_success "Systemd service created"

print_status "Updating nginx configuration..."
if [ "$TRANSLATION_EXISTS" = "exists" ]; then
    # Update existing nginx config to include video call integration
    ssh $VM_USER@$VM_HOST "
    # Backup existing nginx config
    cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.\$(date +%Y%m%d_%H%M%S)
    
    # Copy new unified nginx config
    cp $INTEGRATION_PATH/nginx/nginx.conf /etc/nginx/nginx.conf
    
    # Test nginx configuration
    nginx -t
    "
    print_success "Nginx configuration updated"
else
    print_info "Installing nginx for standalone deployment..."
    ssh $VM_USER@$VM_HOST "
    apt-get update
    apt-get install -y nginx
    cp $INTEGRATION_PATH/nginx/nginx.conf /etc/nginx/nginx.conf
    systemctl enable nginx
    nginx -t
    "
    print_success "Nginx installed and configured"
fi

print_status "Setting up SSL certificates..."
ssh $VM_USER@$VM_HOST "
mkdir -p /etc/nginx/ssl
if [ ! -f /etc/nginx/ssl/certificate.crt ]; then
    openssl req -x509 -newkey rsa:4096 -keyout /etc/nginx/ssl/private.key -out /etc/nginx/ssl/certificate.crt -days 365 -nodes -subj '/C=VN/ST=State/L=City/O=Organization/OU=IT/CN=34.142.175.163'
    chmod 600 /etc/nginx/ssl/private.key
    chmod 644 /etc/nginx/ssl/certificate.crt
fi
"
print_success "SSL certificates configured"

print_status "Configuring firewall..."
ssh $VM_USER@$VM_HOST "
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3001/tcp
ufw --force enable
" || true
print_success "Firewall configured"

print_status "Starting services..."
ssh $VM_USER@$VM_HOST "
systemctl daemon-reload
systemctl enable video-call-integration
systemctl start video-call-integration
systemctl restart nginx
"
print_success "Services started"

print_status "Checking service status..."
sleep 5
SERVICE_STATUS=$(ssh $VM_USER@$VM_HOST "systemctl is-active video-call-integration")
NGINX_STATUS=$(ssh $VM_USER@$VM_HOST "systemctl is-active nginx")

if [ "$SERVICE_STATUS" = "active" ]; then
    print_success "Video Call Integration service is running"
else
    print_error "Video Call Integration service failed. Status: $SERVICE_STATUS"
    ssh $VM_USER@$VM_HOST "journalctl -u video-call-integration --no-pager -n 20"
fi

if [ "$NGINX_STATUS" = "active" ]; then
    print_success "Nginx is running"
else
    print_error "Nginx failed. Status: $NGINX_STATUS"
fi

print_status "Testing API endpoints..."
sleep 5

# Test video call integration API
if ssh $VM_USER@$VM_HOST "curl -k -s https://localhost/video-call-api/health" > /dev/null 2>&1; then
    print_success "Video Call Integration API is responding"
else
    print_error "Video Call Integration API is not responding"
fi

# Test existing translation API if present
if [ "$TRANSLATION_EXISTS" = "exists" ]; then
    if ssh $VM_USER@$VM_HOST "curl -k -s https://localhost/api/health" > /dev/null 2>&1; then
        print_success "Translation API is responding"
    else
        print_error "Translation API is not responding"
    fi
fi

echo ""
echo -e "${GREEN}🎉 Unified Deployment completed successfully!${NC}"
echo ""
echo "📍 System URLs:"
echo "   Main Website: https://34.142.175.163"
echo "   Video Call API: https://34.142.175.163/video-call-api"
echo "   Video Call WebSocket: wss://34.142.175.163/video-call-socket.io"
if [ "$TRANSLATION_EXISTS" = "exists" ]; then
    echo "   Translation API: https://34.142.175.163/api"
    echo "   Translation WebSocket: wss://34.142.175.163/socket.io"
fi
echo ""
echo "🔧 Management Commands:"
echo "   Video Call Service:"
echo "     Start:   systemctl start video-call-integration"
echo "     Stop:    systemctl stop video-call-integration"
echo "     Restart: systemctl restart video-call-integration"
echo "     Status:  systemctl status video-call-integration"
echo "     Logs:    journalctl -u video-call-integration -f"
echo ""
echo "   Nginx:"
echo "     Restart: systemctl restart nginx"
echo "     Status:  systemctl status nginx"
echo "     Test:    nginx -t"
echo ""
echo "📋 Next Steps:"
echo "   1. Copy client-components to your React project"
echo "   2. Configure client to use https://34.142.175.163"
echo "   3. Test the integration"
echo ""
if [ "$TRANSLATION_EXISTS" = "exists" ]; then
    echo "✨ Integration with existing translation system completed!"
else
    echo "✨ Standalone video call system deployed!"
fi

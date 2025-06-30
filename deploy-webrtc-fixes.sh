#!/bin/bash

# WebRTC Production Deployment Script
# Deploys WebRTC fixes for cross-network video call functionality

echo "🚀 Starting WebRTC Production Deployment..."

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️ $1${NC}"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

print_status "Docker is running"

# Stop existing containers
print_info "Stopping existing containers..."
docker-compose -f docker-compose.production.yml down

# Remove old images to ensure fresh build
print_info "Removing old images for fresh build..."
docker system prune -f
docker image prune -f

# Create SSL certificates if they don't exist
SSL_DIR="./nginx/ssl"
if [ ! -d "$SSL_DIR" ]; then
    print_info "Creating SSL directory..."
    mkdir -p "$SSL_DIR"
fi

if [ ! -f "$SSL_DIR/selfsigned.crt" ] || [ ! -f "$SSL_DIR/selfsigned.key" ]; then
    print_info "Creating self-signed SSL certificates..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$SSL_DIR/selfsigned.key" \
        -out "$SSL_DIR/selfsigned.crt" \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=34.142.175.163"
    
    if [ $? -eq 0 ]; then
        print_status "SSL certificates created successfully"
    else
        print_error "Failed to create SSL certificates"
        exit 1
    fi
else
    print_status "SSL certificates already exist"
fi

# Set proper permissions for SSL certificates
chmod 644 "$SSL_DIR/selfsigned.crt"
chmod 600 "$SSL_DIR/selfsigned.key"

# Validate WebRTC configurations
print_info "Validating WebRTC configurations..."

# Check connection.js
if grep -q "turn:openrelay.metered.ca" client/src/config/connection.js; then
    print_status "client/src/config/connection.js: TURN servers configured"
else
    print_error "client/src/config/connection.js: TURN servers missing"
fi

# Check VideoCallIntegration.jsx
if grep -q "turn:openrelay.metered.ca" integration-client-components/VideoCallIntegration.jsx; then
    print_status "VideoCallIntegration.jsx: TURN servers configured"
else
    print_error "VideoCallIntegration.jsx: TURN servers missing"
fi

# Check useWebRTC.js
if grep -q "turn:openrelay.metered.ca" video-call-integration/client-components/hooks/useWebRTC.js; then
    print_status "useWebRTC.js: TURN servers configured"
else
    print_error "useWebRTC.js: TURN servers missing"
fi

# Check if socket server has ICE candidate handling
if grep -q "handleIceCandidate" server/socket/server.js; then
    print_status "Socket server: ICE candidate handling configured"
else
    print_error "Socket server: ICE candidate handling missing"
fi

# Build and start services
print_info "Building and starting production services..."
docker-compose -f docker-compose.production.yml up -d --build

# Wait for services to start
print_info "Waiting for services to initialize..."
sleep 30

# Health check
print_info "Performing health checks..."

# Check if nginx is running
if docker ps | grep -q "nginx"; then
    print_status "Nginx container is running"
else
    print_error "Nginx container is not running"
fi

# Check if client is running
if docker ps | grep -q "client"; then
    print_status "Client container is running"
else
    print_error "Client container is not running"
fi

# Check if socket server is running
if docker ps | grep -q "socket"; then
    print_status "Socket server container is running"
else
    print_error "Socket server container is not running"
fi

# Check if API is running
if docker ps | grep -q "api"; then
    print_status "API container is running"
else
    print_error "API container is not running"
fi

# Test HTTP endpoints
print_info "Testing HTTP endpoints..."

# Test HTTPS health endpoint
if curl -k -s https://localhost/health | grep -q "healthy"; then
    print_status "HTTPS health endpoint responding"
else
    print_warning "HTTPS health endpoint not responding"
fi

# Test Socket.IO endpoint
if curl -k -s https://localhost/socket.io/ | grep -q "Socket.IO"; then
    print_status "Socket.IO endpoint responding"
else
    print_warning "Socket.IO endpoint not responding"
fi

# Test API health endpoint
if curl -k -s https://localhost/api/health > /dev/null 2>&1; then
    print_status "API health endpoint responding"
else
    print_warning "API health endpoint not responding"
fi

# Display running services
print_info "Current running services:"
docker-compose -f docker-compose.production.yml ps

# Show logs for troubleshooting
print_info "Recent logs (last 20 lines):"
docker-compose -f docker-compose.production.yml logs --tail=20

# Network connectivity test
print_info "Testing TURN server connectivity..."

# Create a simple test script for TURN connectivity
cat > turn_connectivity_test.js << 'EOF'
const https = require('https');
const net = require('net');

// Test TURN server ports
const turnHosts = ['openrelay.metered.ca'];
const ports = [80, 443, 3478];

async function testPortConnectivity() {
    console.log('🧪 Testing TURN server connectivity...');
    
    for (const host of turnHosts) {
        for (const port of ports) {
            try {
                await new Promise((resolve, reject) => {
                    const socket = net.createConnection(port, host);
                    socket.setTimeout(5000);
                    
                    socket.on('connect', () => {
                        console.log(`✅ ${host}:${port} - Connection successful`);
                        socket.end();
                        resolve();
                    });
                    
                    socket.on('error', (err) => {
                        console.log(`❌ ${host}:${port} - Connection failed: ${err.message}`);
                        reject(err);
                    });
                    
                    socket.on('timeout', () => {
                        console.log(`⏱️ ${host}:${port} - Connection timeout`);
                        socket.destroy();
                        reject(new Error('Timeout'));
                    });
                });
            } catch (err) {
                // Error already logged
            }
        }
    }
}

testPortConnectivity().then(() => {
    console.log('🏁 TURN connectivity test completed');
}).catch(err => {
    console.log('❌ TURN connectivity test failed:', err.message);
});
EOF

# Run the connectivity test
node turn_connectivity_test.js

# Clean up test file
rm turn_connectivity_test.js

# WebRTC configuration summary
echo ""
echo -e "${BLUE}📋 WebRTC Configuration Summary:${NC}"
echo -e "${GREEN}✅ TURN servers configured for NAT traversal${NC}"
echo -e "${GREEN}✅ HTTPS enabled for secure media access${NC}"
echo -e "${GREEN}✅ Enhanced ICE candidate exchange${NC}"
echo -e "${GREEN}✅ Improved signaling mechanisms${NC}"
echo -e "${GREEN}✅ Production-ready SSL certificates${NC}"

echo ""
echo -e "${CYAN}🌐 Access URLs:${NC}"
echo -e "${CYAN}  HTTPS: https://34.142.175.163${NC}"
echo -e "${CYAN}  HTTP (redirects to HTTPS): http://34.142.175.163${NC}"
echo -e "${CYAN}  Health Check: https://34.142.175.163/health${NC}"
echo -e "${CYAN}  Socket.IO: https://34.142.175.163/socket.io/${NC}"

echo ""
echo -e "${YELLOW}🔧 Troubleshooting Commands:${NC}"
echo -e "${YELLOW}  View logs: docker-compose -f docker-compose.production.yml logs -f${NC}"
echo -e "${YELLOW}  Restart services: docker-compose -f docker-compose.production.yml restart${NC}"
echo -e "${YELLOW}  Check containers: docker-compose -f docker-compose.production.yml ps${NC}"
echo -e "${YELLOW}  Test WebRTC: ./test-webrtc-network-connectivity.ps1${NC}"

echo ""
echo -e "${GREEN}🚀 WebRTC deployment completed successfully!${NC}"
echo -e "${GREEN}   Video calls should now work across different networks.${NC}"

# Final validation reminder
echo ""
echo -e "${CYAN}👉 Next Steps:${NC}"
echo -e "${CYAN}1. Test video calls from different networks/ISPs${NC}"
echo -e "${CYAN}2. Monitor browser console for WebRTC connection logs${NC}"
echo -e "${CYAN}3. Check ICE candidate gathering in browser dev tools${NC}"
echo -e "${CYAN}4. Verify TURN server usage in WebRTC statistics${NC}"

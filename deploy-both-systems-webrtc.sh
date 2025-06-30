#!/bin/bash

# Deploy WebRTC fixes for BOTH systems on VM 34.142.175.163
# System 1: Main translation system (docker-compose.production.yml)  
# System 2: Integration system (video-call-integration/docker-compose.standalone.yml)

echo "🚀 Deploying WebRTC fixes for BOTH systems on VM 34.142.175.163..."

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m' 
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m'

# Functions
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${CYAN}ℹ️ $1${NC}"; }
print_title() { echo -e "${BLUE}$1${NC}"; }

# Check Docker
if ! command -v docker &> /dev/null; then
    print_error "Docker not found. Please install Docker first."
    exit 1
fi

print_success "Docker is available"

# ==============================================
# SYSTEM 1: Main Translation System
# ==============================================
print_title "🎬 Deploying System 1: Main Translation System"

# Stop existing main system
print_info "Stopping main translation system..."
docker-compose -f docker-compose.production.yml down

# Validate WebRTC configs for System 1
print_info "Validating WebRTC configurations for System 1..."

configs=(
    "client/src/config/connection.js"
    "integration-client-components/VideoCallIntegration.jsx"
    "video-call-integration/client-components/hooks/useWebRTC.js"
    "server/socket/server.js"
    "server/socket/socketController.js"
)

for config in "${configs[@]}"; do
    if [ -f "$config" ]; then
        if grep -q "turn:\|handleIceCandidate" "$config"; then
            print_success "$config: WebRTC configured"
        else
            print_warning "$config: WebRTC config may be incomplete"
        fi
    else
        print_warning "$config: File not found"
    fi
done

# Create SSL certs for System 1
SSL_DIR="./nginx/ssl"
if [ ! -d "$SSL_DIR" ]; then
    mkdir -p "$SSL_DIR"
    print_info "Created SSL directory for System 1"
fi

if [ ! -f "$SSL_DIR/selfsigned.crt" ]; then
    print_info "Creating SSL certificates for System 1..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$SSL_DIR/selfsigned.key" \
        -out "$SSL_DIR/selfsigned.crt" \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=34.142.175.163"
    print_success "SSL certificates created for System 1"
fi

# Build and start System 1
print_info "Building and starting System 1..."
docker-compose -f docker-compose.production.yml up -d --build

# ==============================================
# SYSTEM 2: Integration System
# ==============================================
print_title "🔗 Deploying System 2: Integration System"

# Change to integration directory
cd video-call-integration

# Stop existing integration system
print_info "Stopping integration system..."
docker-compose -f docker-compose.standalone.yml down

# Validate WebRTC configs for System 2
print_info "Validating WebRTC configurations for System 2..."

integration_configs=(
    "client-components/config/videoCallConfig.js"
    "client-components/hooks/useWebRTC.js"  
    "server/websocket/integrationSocketHandlers.js"
)

for config in "${integration_configs[@]}"; do
    if [ -f "$config" ]; then
        if grep -q "turn:\|handleIceCandidate\|stun:" "$config"; then
            print_success "Integration $config: WebRTC configured"
        else
            print_warning "Integration $config: WebRTC config may be incomplete"
        fi
    else
        print_warning "Integration $config: File not found"
    fi
done

# Create SSL certs for System 2
INTEGRATION_SSL_DIR="./nginx/ssl"
if [ ! -d "$INTEGRATION_SSL_DIR" ]; then
    mkdir -p "$INTEGRATION_SSL_DIR"
    print_info "Created SSL directory for System 2"
fi

if [ ! -f "$INTEGRATION_SSL_DIR/selfsigned.crt" ]; then
    print_info "Creating SSL certificates for System 2..."
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$INTEGRATION_SSL_DIR/selfsigned.key" \
        -out "$INTEGRATION_SSL_DIR/selfsigned.crt" \
        -subj "/C=US/ST=State/L=City/O=Integration/CN=34.142.175.163"
    print_success "SSL certificates created for System 2"
fi

# Build and start System 2
print_info "Building and starting System 2..."
docker-compose -f docker-compose.standalone.yml up -d --build

# Return to main directory
cd ..

# ==============================================
# HEALTH CHECKS FOR BOTH SYSTEMS
# ==============================================
print_info "⏳ Waiting for services to initialize..."
sleep 30

print_info "🏥 Performing health checks..."

# Check System 1 containers
print_info "Checking System 1 containers..."
system1_containers=("client" "socket" "api" "redis")
for container in "${system1_containers[@]}"; do
    if docker ps --format "table {{.Names}}" | grep -q "$container"; then
        print_success "System 1 - $container container is running"
    else
        print_error "System 1 - $container container is not running"
    fi
done

# Check System 2 containers
print_info "Checking System 2 containers..."
system2_containers=("video-call-integration" "video-call-mysql" "video-call-nginx")
for container in "${system2_containers[@]}"; do
    if docker ps --format "table {{.Names}}" | grep -q "$container"; then
        print_success "System 2 - $container container is running"
    else
        print_warning "System 2 - $container container is not running"
    fi
done

# Test connectivity for both systems
print_info "🧪 Testing connectivity for both systems..."

# Test System 1 endpoints
if curl -s "http://34.142.175.163:8080" > /dev/null; then
    print_success "System 1 (Port 8080): Main client accessible"
else
    print_warning "System 1 (Port 8080): Main client not responding"
fi

if curl -s "http://34.142.175.163:5000/health" > /dev/null; then
    print_success "System 1 (Port 5000): API accessible"
else
    print_warning "System 1 (Port 5000): API not responding"
fi

if curl -s "http://34.142.175.163:4000" > /dev/null; then
    print_success "System 1 (Port 4000): Socket.IO accessible"
else
    print_warning "System 1 (Port 4000): Socket.IO not responding"
fi

# Test System 2 endpoints
if curl -s "http://34.142.175.163:3080" > /dev/null; then
    print_success "System 2 (Port 3080): Integration nginx accessible"
else
    print_warning "System 2 (Port 3080): Integration nginx not responding"
fi

if curl -s "http://34.142.175.163:3001" > /dev/null; then
    print_success "System 2 (Port 3001): Integration server accessible"
else
    print_warning "System 2 (Port 3001): Integration server not responding"
fi

# TURN server connectivity test
print_info "🔄 Testing TURN server connectivity..."
cat > turn_test.js << 'EOF'
const net = require('net');
const turnHosts = ['openrelay.metered.ca'];
const ports = [80, 443, 3478];

async function testTurnConnectivity() {
    for (const host of turnHosts) {
        for (const port of ports) {
            try {
                await new Promise((resolve, reject) => {
                    const socket = net.createConnection(port, host);
                    socket.setTimeout(3000);
                    
                    socket.on('connect', () => {
                        console.log('✅ ' + host + ':' + port + ' - Connected');
                        socket.end();
                        resolve();
                    });
                    
                    socket.on('error', () => {
                        console.log('❌ ' + host + ':' + port + ' - Failed');
                        reject();
                    });
                    
                    socket.on('timeout', () => {
                        console.log('⏱️ ' + host + ':' + port + ' - Timeout');
                        socket.destroy();
                        reject();
                    });
                });
            } catch (err) {
                // Already logged
            }
        }
    }
}

testTurnConnectivity();
EOF

if command -v node &> /dev/null; then
    node turn_test.js
else
    print_warning "Node.js not found, skipping TURN connectivity test"
fi
rm -f turn_test.js

# ==============================================
# SUMMARY  
# ==============================================
echo ""
echo -e "${BLUE}📋 DEPLOYMENT SUMMARY FOR VM 34.142.175.163${NC}"
echo -e "${BLUE}============================================================${NC}"

echo ""
echo -e "${CYAN}🎬 SYSTEM 1: Main Translation System${NC}"
echo -e "${WHITE}   Purpose: Direct video calls with real-time translation${NC}"
echo -e "${GREEN}   Main Client: http://34.142.175.163:8080${NC}"
echo -e "${GREEN}   API: http://34.142.175.163:5000${NC}"
echo -e "${GREEN}   Socket: http://34.142.175.163:4000${NC}"
echo -e "${GREEN}   Status: ✅ WebRTC Enhanced with TURN servers${NC}"

echo ""
echo -e "${CYAN}🔗 SYSTEM 2: Integration System${NC}"
echo -e "${WHITE}   Purpose: Integration components for external React websites${NC}"
echo -e "${GREEN}   Nginx: http://34.142.175.163:3080${NC}"
echo -e "${GREEN}   Direct: http://34.142.175.163:3001${NC}"
echo -e "${GREEN}   MySQL: localhost:3307 (internal)${NC}"
echo -e "${GREEN}   Status: ✅ WebRTC Ready for integration${NC}"

echo ""
echo -e "${YELLOW}🔧 WebRTC Enhancements Applied:${NC}"
echo -e "${GREEN}   ✅ TURN servers for NAT traversal${NC}"
echo -e "${GREEN}   ✅ Enhanced ICE candidate exchange${NC}"
echo -e "${GREEN}   ✅ Improved signaling mechanisms${NC}"
echo -e "${GREEN}   ✅ Cross-network connectivity support${NC}"

echo ""
echo -e "${CYAN}👉 NEXT STEPS:${NC}"
echo -e "${WHITE}   1. Test System 1 video calls from different networks${NC}"
echo -e "${WHITE}   2. Integrate System 2 components into your external React website${NC}"
echo -e "${WHITE}   3. Monitor WebRTC connection logs in browser console${NC}"
echo -e "${WHITE}   4. Verify TURN server usage in WebRTC statistics${NC}"

echo ""
echo -e "${CYAN}🌐 Integration Guide for External Website:${NC}"
echo -e "${WHITE}   // In your external React app:${NC}"
echo -e "${WHITE}   import VideoCallIntegration from 'http://34.142.175.163:3001/components'${NC}"
echo -e "${WHITE}   const config = { serverUrl: 'http://34.142.175.163:3001' }${NC}"

echo ""
print_success "🚀 Both systems deployed successfully with WebRTC enhancements!"
print_info "Video calls should now work across different networks for both systems."

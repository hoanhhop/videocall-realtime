#!/bin/bash

# Production HTTPS Deployment Script for Video Call Translation System
# This script deploys the application with full HTTPS support using Nginx

set -e

echo "🚀 Starting Production HTTPS Deployment..."

# VM Configuration
VM_IP="34.142.175.163"
VM_USER="hopboy553"
PROJECT_DIR="/home/$VM_USER/video-call-translation"

echo "📡 VM: $VM_USER@$VM_IP"
echo "📁 Project Directory: $PROJECT_DIR"

# Step 1: Upload updated configuration files
echo "📤 Uploading configuration files..."

# Upload Docker Compose production config
scp docker-compose.production.yml $VM_USER@$VM_IP:$PROJECT_DIR/

# Upload Nginx production config
scp nginx.production.conf $VM_USER@$VM_IP:$PROJECT_DIR/

# Upload updated client context files
scp client/src/contexts/TranslationContext.jsx $VM_USER@$VM_IP:$PROJECT_DIR/client/src/contexts/
scp client/src/contexts/CallContext.jsx $VM_USER@$VM_IP:$PROJECT_DIR/client/src/contexts/

echo "✅ Configuration files uploaded successfully!"

# Step 2: Deploy on VM
echo "🔧 Executing deployment on VM..."

ssh $VM_USER@$VM_IP << 'ENDSSH'
set -e

PROJECT_DIR="/home/hopboy553/video-call-translation"
cd $PROJECT_DIR

echo "🛑 Stopping existing services..."
docker-compose down --remove-orphans 2>/dev/null || true

echo "🏗️ Building updated containers..."
# Build client with new context files
docker-compose -f docker-compose.production.yml build --no-cache client

# Build other services if needed
docker-compose -f docker-compose.production.yml build api socket

echo "🔧 Configuring Nginx..."

# Copy Nginx config to sites-available
sudo cp nginx.production.conf /etc/nginx/sites-available/video-call-translation

# Enable the site
sudo ln -sf /etc/nginx/sites-available/video-call-translation /etc/nginx/sites-enabled/

# Remove default site
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
echo "🧪 Testing Nginx configuration..."
sudo nginx -t

echo "🚀 Starting services..."

# Start Docker services
docker-compose -f docker-compose.production.yml up -d

# Wait for services to start
echo "⏳ Waiting for services to initialize..."
sleep 30

# Check service health
echo "🏥 Checking service health..."
docker-compose -f docker-compose.production.yml ps

# Check if ports are listening
echo "📡 Checking port availability..."
netstat -tuln | grep -E "(4000|5000|8080)" || echo "⚠️ Some ports may not be ready yet"

echo "🔄 Restarting Nginx..."
sudo systemctl restart nginx

# Check Nginx status
sudo systemctl status nginx --no-pager

echo "🔍 Final connectivity tests..."

# Test HTTP to HTTPS redirect
echo "Testing HTTP redirect..."
curl -I http://34.142.175.163 || echo "⚠️ HTTP redirect test failed"

# Test HTTPS connectivity (ignore cert warnings for self-signed)
echo "Testing HTTPS connectivity..."
curl -k -I https://34.142.175.163 || echo "⚠️ HTTPS connectivity test failed"

# Test backend API
echo "Testing API connectivity..."
curl -k https://34.142.175.163/api/health || echo "⚠️ API health check failed"

# Test Socket.IO
echo "Testing Socket.IO connectivity..."
curl -k https://34.142.175.163/socket.io/socket.io.js || echo "⚠️ Socket.IO test failed"

echo "✅ Deployment completed!"
echo ""
echo "🌐 Access your application at: https://34.142.175.163"
echo "⚠️  Note: You'll see a security warning due to self-signed certificate"
echo "🔧 To avoid the warning, accept the certificate in your browser"
echo ""
echo "📊 Service Status:"
docker-compose -f docker-compose.production.yml ps
echo ""
echo "📋 Quick verification commands:"
echo "  • Test HTTPS: curl -k https://34.142.175.163"
echo "  • Check logs: docker-compose -f docker-compose.production.yml logs -f"
echo "  • Monitor services: docker stats"

ENDSSH

echo ""
echo "🎉 Production HTTPS deployment completed!"
echo "🌐 Your application is now available at: https://34.142.175.163"
echo ""
echo "📝 Important Notes:"
echo "  • getUserMedia API will now work properly over HTTPS"
echo "  • Accept the self-signed certificate warning in your browser"  
echo "  • All WebSocket connections are now secured with WSS"
echo "  • Rate limiting and security headers are active"
echo ""
echo "🔧 If you encounter issues:"
echo "  • Check container logs: ssh $VM_USER@$VM_IP 'cd $PROJECT_DIR && docker-compose -f docker-compose.production.yml logs'"
echo "  • Check Nginx logs: ssh $VM_USER@$VM_IP 'sudo tail -f /var/log/nginx/error.log'"
echo "  • Restart services: ssh $VM_USER@$VM_IP 'cd $PROJECT_DIR && docker-compose -f docker-compose.production.yml restart'"

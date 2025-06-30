# Production HTTPS Deployment Script for Video Call Translation System
# PowerShell version for Windows deployment

Write-Host "🚀 Starting Production HTTPS Deployment..." -ForegroundColor Green

# VM Configuration
$VM_IP = "34.142.175.163"
$VM_USER = "hopboy553"
$PROJECT_DIR = "/home/$VM_USER/video-call-translation"

Write-Host "📡 VM: $VM_USER@$VM_IP" -ForegroundColor Cyan
Write-Host "📁 Project Directory: $PROJECT_DIR" -ForegroundColor Cyan

# Step 1: Upload updated configuration files
Write-Host "📤 Uploading configuration files..." -ForegroundColor Yellow

try {
    # Upload Docker Compose production config
    scp docker-compose.production.yml "${VM_USER}@${VM_IP}:${PROJECT_DIR}/"
    
    # Upload Nginx production config  
    scp nginx.production.conf "${VM_USER}@${VM_IP}:${PROJECT_DIR}/"
    
    # Upload updated client context files
    scp client/src/contexts/TranslationContext.jsx "${VM_USER}@${VM_IP}:${PROJECT_DIR}/client/src/contexts/"
    scp client/src/contexts/CallContext.jsx "${VM_USER}@${VM_IP}:${PROJECT_DIR}/client/src/contexts/"
    
    Write-Host "✅ Configuration files uploaded successfully!" -ForegroundColor Green
}
catch {
    Write-Host "❌ Error uploading files: $_" -ForegroundColor Red
    exit 1
}

# Step 2: Deploy on VM
Write-Host "🔧 Executing deployment on VM..." -ForegroundColor Yellow

$deploymentScript = @"
set -e

PROJECT_DIR="/home/hopboy553/video-call-translation"
cd `$PROJECT_DIR

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
"@

try {
    # Execute deployment on VM
    $deploymentScript | ssh "${VM_USER}@${VM_IP}" "bash -s"
    
    Write-Host ""
    Write-Host "🎉 Production HTTPS deployment completed!" -ForegroundColor Green
    Write-Host "🌐 Your application is now available at: https://34.142.175.163" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📝 Important Notes:" -ForegroundColor Yellow
    Write-Host "  • getUserMedia API will now work properly over HTTPS" -ForegroundColor White
    Write-Host "  • Accept the self-signed certificate warning in your browser" -ForegroundColor White
    Write-Host "  • All WebSocket connections are now secured with WSS" -ForegroundColor White
    Write-Host "  • Rate limiting and security headers are active" -ForegroundColor White
    Write-Host ""
    Write-Host "🔧 If you encounter issues:" -ForegroundColor Yellow
    Write-Host "  • Check container logs: ssh $VM_USER@$VM_IP 'cd $PROJECT_DIR && docker-compose -f docker-compose.production.yml logs'" -ForegroundColor White
    Write-Host "  • Check Nginx logs: ssh $VM_USER@$VM_IP 'sudo tail -f /var/log/nginx/error.log'" -ForegroundColor White
    Write-Host "  • Restart services: ssh $VM_USER@$VM_IP 'cd $PROJECT_DIR && docker-compose -f docker-compose.production.yml restart'" -ForegroundColor White
}
catch {
    Write-Host "❌ Deployment failed: $_" -ForegroundColor Red
    Write-Host "🔧 Troubleshooting steps:" -ForegroundColor Yellow
    Write-Host "  1. Check SSH connectivity: ssh $VM_USER@$VM_IP" -ForegroundColor White
    Write-Host "  2. Verify files uploaded: ssh $VM_USER@$VM_IP 'ls -la $PROJECT_DIR'" -ForegroundColor White
    Write-Host "  3. Check Docker status: ssh $VM_USER@$VM_IP 'docker ps'" -ForegroundColor White
    exit 1
}

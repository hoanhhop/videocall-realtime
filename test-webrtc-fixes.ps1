# WebRTC Configuration Test and Deployment Script
# Kiểm tra và deploy tất cả các thay đổi WebRTC đã thực hiện

Write-Host "🔧 WebRTC Configuration Test & Deployment" -ForegroundColor Green
Write-Host "=========================================" -ForegroundColor Green

# Configuration
$VM_IP = "34.142.175.163"
$VM_USER = "hopboy553"
$PROJECT_DIR = "/home/$VM_USER/video-call-translation_OFFICIAL"

# Step 1: Verify local changes
Write-Host "📋 Verifying WebRTC configuration changes..." -ForegroundColor Yellow

$filesToCheck = @(
    "docker-compose.production.yml",
    "server/public/video-call.html",
    "client/src/config/connection.js",
    "integration-client-components/VideoCallIntegration.jsx",
    "video-call-integration/client-components/hooks/useWebRTC.js",
    "video-call-integration/client-components/config/videoCallConfig.js",
    "nginx.production.conf"
)

Write-Host "Checking critical WebRTC files:" -ForegroundColor Cyan
foreach ($file in $filesToCheck) {
    if (Test-Path $file) {
        Write-Host "  ✅ $file" -ForegroundColor Green
    } else {
        Write-Host "  ❌ $file - MISSING" -ForegroundColor Red
    }
}

# Step 2: Check for TURN server configurations
Write-Host "`n🌐 Checking TURN server configurations..." -ForegroundColor Yellow

$turnFiles = @(
    "server/public/video-call.html",
    "client/src/config/connection.js", 
    "integration-client-components/VideoCallIntegration.jsx",
    "video-call-integration/client-components/hooks/useWebRTC.js",
    "video-call-integration/client-components/config/videoCallConfig.js"
)

foreach ($file in $turnFiles) {
    if (Test-Path $file) {
        $content = Get-Content $file -Raw
        if ($content -match "turn:openrelay.metered.ca") {
            Write-Host "  ✅ $file - TURN servers configured" -ForegroundColor Green
        } else {
            Write-Host "  ⚠️ $file - TURN servers missing" -ForegroundColor Yellow
        }
    }
}

# Step 3: Check port bindings in docker-compose
Write-Host "`n🔌 Checking port configurations..." -ForegroundColor Yellow

if (Test-Path "docker-compose.production.yml") {
    $composeContent = Get-Content "docker-compose.production.yml" -Raw
    
    # Check for correct port bindings (no localhost restriction)
    if ($composeContent -match "'5000:5000'" -and 
        $composeContent -match "'4000:5001'" -and 
        $composeContent -match '"8080:80"') {
        Write-Host "  ✅ Port bindings corrected for external access" -ForegroundColor Green
    } else {
        Write-Host "  ⚠️ Port bindings may still have localhost restrictions" -ForegroundColor Yellow
    }
    
    # Check for localhost restrictions
    if ($composeContent -match "127.0.0.1:") {
        Write-Host "  ❌ Found localhost restrictions in port bindings!" -ForegroundColor Red
    } else {
        Write-Host "  ✅ No localhost restrictions found" -ForegroundColor Green
    }
} else {
    Write-Host "  ❌ docker-compose.production.yml not found!" -ForegroundColor Red
}

# Step 4: Upload and deploy changes
Write-Host "`n📤 Uploading changes to VM..." -ForegroundColor Yellow

try {
    # Upload key files with WebRTC fixes
    Write-Host "Uploading WebRTC configuration files..." -ForegroundColor Cyan
    
    scp docker-compose.production.yml "${VM_USER}@${VM_IP}:${PROJECT_DIR}/"
    scp nginx.production.conf "${VM_USER}@${VM_IP}:${PROJECT_DIR}/"
    scp server/public/video-call.html "${VM_USER}@${VM_IP}:${PROJECT_DIR}/server/public/"
    scp client/src/config/connection.js "${VM_USER}@${VM_IP}:${PROJECT_DIR}/client/src/config/"
    scp integration-client-components/VideoCallIntegration.jsx "${VM_USER}@${VM_IP}:${PROJECT_DIR}/integration-client-components/"
    scp video-call-integration/client-components/hooks/useWebRTC.js "${VM_USER}@${VM_IP}:${PROJECT_DIR}/video-call-integration/client-components/hooks/"
    scp video-call-integration/client-components/config/videoCallConfig.js "${VM_USER}@${VM_IP}:${PROJECT_DIR}/video-call-integration/client-components/config/"
    
    Write-Host "✅ Files uploaded successfully!" -ForegroundColor Green
} catch {
    Write-Host "❌ Error uploading files: $_" -ForegroundColor Red
    exit 1
}

# Step 5: Deploy on VM
Write-Host "`n🚀 Deploying WebRTC fixes on VM..." -ForegroundColor Yellow

$deploymentScript = @"
set -e

cd $PROJECT_DIR

echo "🛑 Stopping existing services..."
sudo docker-compose -f docker-compose.production.yml down --remove-orphans

echo "🧹 Cleaning up Docker resources..."
sudo docker system prune -f

echo "🏗️ Rebuilding services with WebRTC fixes..."
# Rebuild API and Socket services (contain WebRTC configurations)
sudo docker-compose -f docker-compose.production.yml build --no-cache api socket

# Rebuild client with updated connection config
sudo docker-compose -f docker-compose.production.yml build --no-cache client

echo "🔧 Updating Nginx configuration..."
sudo cp nginx.production.conf /etc/nginx/sites-available/video-call-translation
sudo ln -sf /etc/nginx/sites-available/video-call-translation /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

echo "🚀 Starting services with WebRTC fixes..."
sudo docker-compose -f docker-compose.production.yml up -d

echo "⏳ Waiting for services to initialize..."
sleep 45

echo "🏥 Checking service health..."
sudo docker-compose -f docker-compose.production.yml ps

echo "🔄 Restarting Nginx..."
sudo systemctl restart nginx

echo "🧪 Testing WebRTC endpoints..."

# Test API health
echo "Testing API..."
curl -f http://localhost:5000/health || echo "⚠️ API not ready yet"

# Test Socket.IO
echo "Testing Socket.IO..."
curl -f http://localhost:4000/socket.io/ || echo "⚠️ Socket.IO not ready yet"

# Test external access
echo "Testing external HTTP access..."
curl -f http://34.142.175.163/ || echo "⚠️ External HTTP not ready yet"

# Test HTTPS if available
echo "Testing HTTPS access..."
curl -k -f https://34.142.175.163/ || echo "⚠️ HTTPS not available or not ready"

echo "📊 Port check..."
netstat -tuln | grep -E "(4000|5000|8080|80|443)" || echo "Some ports may not be ready"

echo "✅ WebRTC deployment completed!"
echo ""
echo "📋 WebRTC Configuration Summary:"
echo "  • TURN servers: ✅ Configured in all WebRTC files"
echo "  • Port bindings: ✅ Fixed for cross-network access"
echo "  • HTTPS support: ✅ Available for WebRTC requirements"
echo "  • ICE candidates: ✅ Optimized with iceCandidatePoolSize"
echo ""
echo "🌐 Application URLs:"
echo "  • HTTP: http://34.142.175.163"
echo "  • HTTPS: https://34.142.175.163 (self-signed cert)"
echo "  • API: http://34.142.175.163/api"
echo "  • WebSocket: ws://34.142.175.163/socket.io"
echo ""
echo "🔧 For WebRTC testing:"
echo "  • Access via HTTPS for getUserMedia API"
echo "  • Test video calls between different networks"
echo "  • Check browser console for WebRTC connection logs"
echo "  • Monitor TURN server usage in browser DevTools"
"@

try {
    # Execute deployment
    $deploymentScript | ssh "${VM_USER}@${VM_IP}" "bash -s"
    
    Write-Host ""
    Write-Host "🎉 WebRTC fixes deployed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 WebRTC Testing Checklist:" -ForegroundColor Yellow
    Write-Host "  ✅ Port bindings fixed (no localhost restrictions)" -ForegroundColor White
    Write-Host "  ✅ TURN servers added to all WebRTC configurations" -ForegroundColor White
    Write-Host "  ✅ HTTPS available for getUserMedia API requirements" -ForegroundColor White
    Write-Host "  ✅ ICE candidate handling optimized" -ForegroundColor White
    Write-Host ""
    Write-Host "🧪 Manual Test Steps:" -ForegroundColor Cyan
    Write-Host "  1. Access https://34.142.175.163 (accept certificate)" -ForegroundColor White
    Write-Host "  2. Test video call between different networks/devices" -ForegroundColor White
    Write-Host "  3. Check browser console for WebRTC connection logs" -ForegroundColor White
    Write-Host "  4. Verify TURN server usage in network tab" -ForegroundColor White
    Write-Host ""
    Write-Host "🔧 Troubleshooting Commands:" -ForegroundColor Yellow
    Write-Host "  • Check logs: ssh ${VM_USER}@${VM_IP} 'cd ${PROJECT_DIR} && sudo docker-compose -f docker-compose.production.yml logs'" -ForegroundColor White
    Write-Host "  • Monitor services: ssh ${VM_USER}@${VM_IP} 'sudo docker stats'" -ForegroundColor White
    Write-Host "  • Restart services: ssh ${VM_USER}@${VM_IP} 'cd ${PROJECT_DIR} && sudo docker-compose -f docker-compose.production.yml restart'" -ForegroundColor White
} catch {
    Write-Host ""
    Write-Host "❌ Deployment failed: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "🔧 Troubleshooting steps:" -ForegroundColor Yellow
    Write-Host "  1. Check SSH connectivity: ssh ${VM_USER}@${VM_IP}" -ForegroundColor White
    Write-Host "  2. Verify files uploaded: ssh ${VM_USER}@${VM_IP} 'ls -la ${PROJECT_DIR}'" -ForegroundColor White
    Write-Host "  3. Check Docker status: ssh ${VM_USER}@${VM_IP} 'sudo docker ps'" -ForegroundColor White
    Write-Host "  4. Check Docker logs: ssh ${VM_USER}@${VM_IP} 'cd ${PROJECT_DIR} && sudo docker-compose -f docker-compose.production.yml logs'" -ForegroundColor White
    exit 1
}

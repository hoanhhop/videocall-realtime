# Deploy WebRTC fixes for BOTH systems on VM 34.142.175.163 via SSH
# System 1: Main translation system (docker-compose.production.yml)
# System 2: Integration system (video-call-integration/docker-compose.standalone.yml)

Write-Host "🚀 Deploying WebRTC fixes for BOTH systems on VM 34.142.175.163 via SSH..." -ForegroundColor Green

# Color functions
function Write-Success { param($msg) Write-Host "✅ $msg" -ForegroundColor Green }
function Write-Warning { param($msg) Write-Host "⚠️ $msg" -ForegroundColor Yellow }
function Write-Error { param($msg) Write-Host "❌ $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "ℹ️ $msg" -ForegroundColor Cyan }

# VM Connection Details
$VM_USER = "hopboy553"
$VM_HOST = "34.142.175.163"
$VM_PATH = "/home/hopboy553/video-call-translation_OFFICIAL"

# Check SSH connectivity
Write-Info "Testing SSH connection to ${VM_USER}@${VM_HOST}..."
$sshTest = ssh -o ConnectTimeout=10 -o BatchMode=yes ${VM_USER}@${VM_HOST} "echo 'SSH connection successful'"
# ==============================================
# UPLOAD FILES TO VM
# ==============================================
Write-Info "📤 Uploading updated files to VM..."

# Upload all modified WebRTC files
$filesToUpload = @(
    "server/socket/socketController.js",
    "server/socket/server.js", 
    "client/src/services/webrtc.js",
    "client/src/config/connection.js",
    "integration-client-components/VideoCallIntegration.jsx",
    "video-call-integration/client-components/hooks/useWebRTC.js",
    "docker-compose.production.yml",
    "video-call-integration/docker-compose.standalone.yml"
)

foreach ($file in $filesToUpload) {
    if (Test-Path $file) {
        $remotePath = "${VM_PATH}/${file}"
        $remoteDir = Split-Path $remotePath -Parent
        
        # Create remote directory if it doesn't exist
        ssh ${VM_USER}@${VM_HOST} "mkdir -p $remoteDir"
        
        # Upload file
        scp $file ${VM_USER}@${VM_HOST}:$remotePath
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Uploaded: $file"
        } else {
            Write-Error "Failed to upload: $file"
        }
    } else {
        Write-Warning "File not found: $file"
    }
}

# ==============================================
# SYSTEM 1: Main Translation System (via SSH)
# ==============================================
Write-Info "🎬 Deploying System 1: Main Translation System on VM"

$system1Commands = @"
cd $VM_PATH

echo "🛑 Stopping main translation system..."
docker-compose -f docker-compose.production.yml down

echo "🔍 Validating WebRTC configurations for System 1..."
grep -q "turn:openrelay.metered.ca" client/src/config/connection.js && echo "✅ client/src/config/connection.js: TURN configured" || echo "❌ client/src/config/connection.js: TURN missing"
# ==============================================
# SYSTEM 2: Integration System (via SSH)
# ==============================================
Write-Info "🔗 Deploying System 2: Integration System on VM"

$system2Commands = @"
cd $VM_PATH/video-call-integration

echo "🛑 Stopping integration system..."
docker-compose -f docker-compose.standalone.yml down

echo "🔍 Validating WebRTC configurations for System 2..."
grep -q "turn:\|stun:" client-components/config/videoCallConfig.js && echo "✅ Integration videoCallConfig.js: WebRTC configured" || echo "❌ Integration videoCallConfig.js: WebRTC missing"
grep -q "handleIceCandidate\|turn:" server/websocket/integrationSocketHandlers.js && echo "✅ Integration socket handlers: WebRTC configured" || echo "❌ Integration socket handlers: WebRTC missing"

echo "🔐 Creating SSL certificates for System 2..."
mkdir -p nginx/ssl
if [ ! -f "nginx/ssl/selfsigned.crt" ]; then
    docker run --rm -v "\$(pwd)/nginx/ssl:/certs" alpine/openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /certs/selfsigned.key -out /certs/selfsigned.crt -subj "/C=US/ST=State/L=City/O=Integration/CN=34.142.175.163"
    echo "✅ SSL certificates created for System 2"
else
    echo "✅ SSL certificates already exist for System 2"
fi

echo "🏗️ Building and starting System 2..."
docker-compose -f docker-compose.standalone.yml up -d --build

echo "✅ System 2 deployment completed"
"@

Write-Info "Executing System 2 deployment commands on VM..."
ssh ${VM_USER}@${VM_HOST} $system2Commands-Path $config) {
        if ((Get-Content $config -Raw) -match "turn:|handleIceCandidate|stun:") {
            Write-Success "Integration $config: WebRTC configured"
        } else {
            Write-Warning "Integration $config: WebRTC config may be incomplete"
        }
    } else {
        Write-Warning "Integration $config: File not found"
    }
}

# Create SSL certs for System 2
$integrationSslDir = "./nginx/ssl"
if (-not (Test-Path $integrationSslDir)) {
    New-Item -ItemType Directory -Path $integrationSslDir -Force
    Write-Info "Created SSL directory for System 2"
}

if (-not (Test-Path "$integrationSslDir/selfsigned.crt")) {
    Write-Info "Creating SSL certificates for System 2..."
    docker run --rm -v "${PWD}/nginx/ssl:/certs" alpine/openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout /certs/selfsigned.key -out /certs/selfsigned.crt -subj "/C=US/ST=State/L=City/O=Integration/CN=34.142.175.163"
    Write-Success "SSL certificates created for System 2"
# ==============================================
# HEALTH CHECKS FOR BOTH SYSTEMS (via SSH)
# ==============================================
Write-Info "⏳ Waiting for services to initialize..."
Start-Sleep 30

Write-Info "🏥 Performing health checks on VM..."

$healthCheckCommands = @"
cd $VM_PATH

echo "🔍 Checking System 1 containers..."
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "client|socket|api|redis" || echo "❌ Some System 1 containers not found"

echo ""
echo "🔍 Checking System 2 containers..."
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "video-call" || echo "❌ Some System 2 containers not found"

echo ""
echo "🧪 Testing System 1 endpoints..."
curl -s -o /dev/null -w "System 1 Port 8080: %{http_code}\n" http://localhost:8080 || echo "System 1 Port 8080: Failed"
curl -s -o /dev/null -w "System 1 Port 5000: %{http_code}\n" http://localhost:5000/health || echo "System 1 Port 5000: Failed"
curl -s -o /dev/null -w "System 1 Port 4000: %{http_code}\n" http://localhost:4000 || echo "System 1 Port 4000: Failed"

echo ""
echo "🧪 Testing System 2 endpoints..."
curl -s -o /dev/null -w "System 2 Port 3080: %{http_code}\n" http://localhost:3080 || echo "System 2 Port 3080: Failed"
curl -s -o /dev/null -w "System 2 Port 3001: %{http_code}\n" http://localhost:3001 || echo "System 2 Port 3001: Failed"

echo ""
echo "🔄 Testing TURN server connectivity..."
nc -zv openrelay.metered.ca 3478 2>&1 | grep succeeded && echo "✅ TURN server reachable" || echo "❌ TURN server not reachable"

echo ""
echo "📊 Container status summary:"
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}"
"@

Write-Info "Executing health checks on VM..."
ssh ${VM_USER}@${VM_HOST} $healthCheckCommands
    }
}

testTurnConnectivity();
"@

$turnTest | Out-File -FilePath "turn_test.js" -Encoding UTF8
node turn_test.js
Remove-Item "turn_test.js"

# ==============================================
# SUMMARY
# ==============================================
Write-Host "`n" -NoNewline
Write-Host "📋 DEPLOYMENT SUMMARY FOR VM 34.142.175.163" -ForegroundColor Blue
Write-Host "=" * 60 -ForegroundColor Blue

Write-Host "`n🎬 SYSTEM 1: Main Translation System" -ForegroundColor Cyan
Write-Host "   Purpose: Direct video calls with real-time translation" -ForegroundColor White
Write-Host "   Main Client: http://34.142.175.163:8080" -ForegroundColor Green
Write-Host "   API: http://34.142.175.163:5000" -ForegroundColor Green  
Write-Host "   Socket: http://34.142.175.163:4000" -ForegroundColor Green
Write-Host "   Status: ✅ WebRTC Enhanced with TURN servers" -ForegroundColor Green

Write-Host "`n🔗 SYSTEM 2: Integration System" -ForegroundColor Cyan
Write-Host "   Purpose: Integration components for external React websites" -ForegroundColor White
Write-Host "   Nginx: http://34.142.175.163:3080" -ForegroundColor Green
Write-Host "   Direct: http://34.142.175.163:3001" -ForegroundColor Green
Write-Host "   MySQL: localhost:3307 (internal)" -ForegroundColor Green
Write-Host "   Status: ✅ WebRTC Ready for integration" -ForegroundColor Green

Write-Host "`n🔧 WebRTC Enhancements Applied:" -ForegroundColor Yellow
Write-Host "   ✅ TURN servers for NAT traversal" -ForegroundColor Green
Write-Host "   ✅ Enhanced ICE candidate exchange" -ForegroundColor Green  
Write-Host "   ✅ Improved signaling mechanisms" -ForegroundColor Green
Write-Host "   ✅ Cross-network connectivity support" -ForegroundColor Green

Write-Host "`n👉 NEXT STEPS:" -ForegroundColor Cyan
Write-Host "   1. Test System 1 video calls from different networks" -ForegroundColor White
Write-Host "   2. Integrate System 2 components into your external React website" -ForegroundColor White
Write-Host "   3. Monitor WebRTC connection logs in browser console" -ForegroundColor White
Write-Host "   4. Verify TURN server usage in WebRTC statistics" -ForegroundColor White

Write-Host "`n🌐 Integration Guide for External Website:" -ForegroundColor Cyan
Write-Host "   // In your external React app:" -ForegroundColor Gray
Write-Host "   import VideoCallIntegration from 'http://34.142.175.163:3001/components'" -ForegroundColor Gray
Write-Host "   const config = { serverUrl: 'http://34.142.175.163:3001' }" -ForegroundColor Gray

Write-Success "`n🚀 Both systems deployed successfully with WebRTC enhancements!"
Write-Info "Video calls should now work across different networks for both systems."
# ==============================================
# REMOTE CONNECTIVITY TEST
# ==============================================
Write-Info "🌐 Testing external connectivity to both systems..."

# Test System 1 endpoints from local machine
Write-Info "Testing System 1 from external..."
try {
    $response1 = Invoke-WebRequest -Uri "http://34.142.175.163:8080" -TimeoutSec 10 -UseBasicParsing
    Write-Success "✅ System 1 (Port 8080): Accessible from external"
} catch {
    Write-Warning "⚠️ System 1 (Port 8080): Not accessible from external"
}

try {
    $response2 = Invoke-WebRequest -Uri "http://34.142.175.163:5000/health" -TimeoutSec 10 -UseBasicParsing
    Write-Success "✅ System 1 (Port 5000): API accessible from external"
} catch {
    Write-Warning "⚠️ System 1 (Port 5000): API not accessible from external"
}

# Test System 2 endpoints from local machine
Write-Info "Testing System 2 from external..."
try {
    $response3 = Invoke-WebRequest -Uri "http://34.142.175.163:3080" -TimeoutSec 10 -UseBasicParsing
    Write-Success "✅ System 2 (Port 3080): Integration accessible from external"
} catch {
    Write-Warning "⚠️ System 2 (Port 3080): Integration not accessible from external"
}

try {
# ==============================================
# SUMMARY
# ==============================================
Write-Host "`n" -NoNewline
Write-Host "📋 DEPLOYMENT SUMMARY FOR VM 34.142.175.163" -ForegroundColor Blue
Write-Host "=" * 60 -ForegroundColor Blue

Write-Host "`n🎬 SYSTEM 1: Main Translation System" -ForegroundColor Cyan
Write-Host "   Purpose: Direct video calls with real-time translation" -ForegroundColor White
Write-Host "   Main Client: http://34.142.175.163:8080" -ForegroundColor Green
Write-Host "   API: http://34.142.175.163:5000" -ForegroundColor Green  
Write-Host "   Socket: http://34.142.175.163:4000" -ForegroundColor Green
Write-Host "   Status: ✅ WebRTC Enhanced with TURN servers" -ForegroundColor Green

Write-Host "`n🔗 SYSTEM 2: Integration System" -ForegroundColor Cyan
Write-Host "   Purpose: Integration components for external React websites" -ForegroundColor White
Write-Host "   Nginx: http://34.142.175.163:3080" -ForegroundColor Green
Write-Host "   Direct: http://34.142.175.163:3001" -ForegroundColor Green
Write-Host "   MySQL: Internal port 3307" -ForegroundColor Green
Write-Host "   Status: ✅ WebRTC Ready for integration" -ForegroundColor Green

Write-Host "`n🔧 WebRTC Enhancements Applied:" -ForegroundColor Yellow
Write-Host "   ✅ TURN servers for NAT traversal" -ForegroundColor Green
Write-Host "   ✅ Enhanced ICE candidate exchange" -ForegroundColor Green  
Write-Host "   ✅ Improved signaling mechanisms" -ForegroundColor Green
Write-Host "   ✅ Cross-network connectivity support" -ForegroundColor Green
Write-Host "   ✅ SSL certificates for secure media access" -ForegroundColor Green

Write-Host "`n👉 NEXT STEPS:" -ForegroundColor Cyan
Write-Host "   1. Test System 1 video calls from different networks" -ForegroundColor White
Write-Host "   2. Integrate System 2 components into your external React website" -ForegroundColor White
Write-Host "   3. Monitor WebRTC connection logs in browser console" -ForegroundColor White
Write-Host "   4. Verify TURN server usage in WebRTC statistics" -ForegroundColor White

Write-Host "`n🌐 Integration Guide for External Website:" -ForegroundColor Cyan
Write-Host "   // In your external React app:" -ForegroundColor Gray
Write-Host "   import VideoCallIntegration from 'http://34.142.175.163:3001/api/components'" -ForegroundColor Gray
Write-Host "   const config = { serverUrl: 'http://34.142.175.163:3001' }" -ForegroundColor Gray
Write-Host "   <VideoCallIntegration config={config} />" -ForegroundColor Gray

Write-Host "`n🔧 Troubleshooting Commands (run on VM):" -ForegroundColor Yellow
Write-Host "   ssh ${VM_USER}@${VM_HOST}" -ForegroundColor Gray
Write-Host "   docker-compose -f docker-compose.production.yml logs -f" -ForegroundColor Gray
Write-Host "   docker-compose -f video-call-integration/docker-compose.standalone.yml logs -f" -ForegroundColor Gray

Write-Success "`n🚀 Both systems deployed successfully with WebRTC enhancements!"
Write-Info "Video calls should now work across different networks for both systems."
Write-Warning "⚠️ Remember to test with actual users on different networks to verify functionality."
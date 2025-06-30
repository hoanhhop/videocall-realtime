# Deploy WebRTC fixes to VM via SSH
# SSH to hopboy553@34.142.175.163 and upload updated files

Write-Host "Deploying WebRTC fixes to VM 34.142.175.163 via SSH..." -ForegroundColor Green

# Color functions
function Write-Success { param($msg) Write-Host "OK $msg" -ForegroundColor Green }
function Write-Warning { param($msg) Write-Host "WARN $msg" -ForegroundColor Yellow }
function Write-Error { param($msg) Write-Host "ERROR $msg" -ForegroundColor Red }
function Write-Info { param($msg) Write-Host "INFO $msg" -ForegroundColor Cyan }

# VM connection details
$vmUser = "hopboy553"
$vmHost = "34.142.175.163"
$vmConnection = "$vmUser@$vmHost"

# Check SSH connectivity
Write-Info "Testing SSH connection to VM..."
$sshTest = ssh -o ConnectTimeout=10 $vmConnection "echo 'SSH connection successful'"
if ($LASTEXITCODE -eq 0) {
    Write-Success "SSH connection established"
} else {
    Write-Error "SSH connection failed"
    exit 1
}

# Step 1: Check current file structure on VM
Write-Info "Checking current file structure on VM..."
$checkStructure = @'
echo "=== Checking main system files ==="
ls -la ~/video-call-translation_OFFICIAL/
echo ""
echo "=== Checking server socket files ==="
ls -la ~/video-call-translation_OFFICIAL/server/socket/
echo ""
echo "=== Checking client src files ==="
ls -la ~/video-call-translation_OFFICIAL/client/src/
echo ""
echo "=== Checking integration directory ==="
ls -la ~/video-call-translation_OFFICIAL/video-call-integration/
echo ""
echo "=== Checking integration client components ==="
ls -la ~/video-call-translation_OFFICIAL/integration-client-components/
'@

ssh $vmConnection $checkStructure

Write-Info "Press Enter to continue with file uploads..."
Read-Host

# Step 2: Create backup of existing files
Write-Info "Creating backup of existing files on VM..."
$backupScript = @'
cd ~/video-call-translation_OFFICIAL
echo "Creating backup directory..."
BACKUP_DIR="backups/webrtc-backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p $BACKUP_DIR

echo "Backing up existing files..."
[ -f server/socket/socketController.js ] && cp server/socket/socketController.js $BACKUP_DIR/ || echo "socketController.js not found"
[ -f server/socket/server.js ] && cp server/socket/server.js $BACKUP_DIR/ || echo "server.js not found"  
[ -f client/src/config/connection.js ] && cp client/src/config/connection.js $BACKUP_DIR/ || echo "connection.js not found"
[ -f integration-client-components/VideoCallIntegration.jsx ] && cp integration-client-components/VideoCallIntegration.jsx $BACKUP_DIR/ || echo "VideoCallIntegration.jsx not found"
[ -f video-call-integration/client-components/hooks/useWebRTC.js ] && cp video-call-integration/client-components/hooks/useWebRTC.js $BACKUP_DIR/ || echo "useWebRTC.js not found"

echo "Backup completed in $BACKUP_DIR"
'@

ssh $vmConnection $backupScript

# Step 3: Upload updated files
Write-Info "Uploading updated WebRTC files..."

# List of files to upload with their destination paths
$filesToUpload = @(
    @{
        Local = "server\socket\socketController.js"
        Remote = "~/video-call-translation_OFFICIAL/server/socket/socketController.js"
        Description = "Enhanced socket controller with ICE candidate handling"
    },
    @{
        Local = "server\socket\server.js"
        Remote = "~/video-call-translation_OFFICIAL/server/socket/server.js"
        Description = "Socket server with ICE candidate event listener"
    },
    @{
        Local = "client\src\services\webrtc.js"
        Remote = "~/video-call-translation_OFFICIAL/client/src/services/webrtc.js"
        Description = "Centralized WebRTC service"
    },
    @{
        Local = "client\src\config\connection.js"
        Remote = "~/video-call-translation_OFFICIAL/client/src/config/connection.js"
        Description = "Connection config with TURN servers"
    },
    @{
        Local = "integration-client-components\VideoCallIntegration.jsx"
        Remote = "~/video-call-translation_OFFICIAL/integration-client-components/VideoCallIntegration.jsx"
        Description = "Video call integration with TURN servers"
    },
    @{
        Local = "video-call-integration\client-components\hooks\useWebRTC.js"
        Remote = "~/video-call-translation_OFFICIAL/video-call-integration/client-components/hooks/useWebRTC.js"
        Description = "WebRTC hook with enhanced ICE servers"
    }
)

foreach ($file in $filesToUpload) {
    Write-Info "Uploading $($file.Description)..."
    
    # Check if local file exists
    if (Test-Path $file.Local) {
        # Create remote directory if it doesn't exist
        $remoteDir = Split-Path $file.Remote -Parent
        ssh $vmConnection "mkdir -p $remoteDir"
        
        # Upload file
        scp $file.Local "${vmConnection}:$($file.Remote)"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Uploaded: $($file.Local)"
        } else {
            Write-Error "Failed to upload: $($file.Local)"
        }
    } else {
        Write-Warning "Local file not found: $($file.Local)"
    }
}

# Step 4: Verify uploaded files
Write-Info "Verifying uploaded files on VM..."
$verifyScript = @'
cd ~/video-call-translation_OFFICIAL
echo "=== Verifying uploaded files ==="
echo "Socket Controller:"
[ -f server/socket/socketController.js ] && echo "OK socketController.js exists" || echo "ERROR socketController.js missing"

echo "Socket Server:"
[ -f server/socket/server.js ] && echo "OK server.js exists" || echo "ERROR server.js missing"

echo "WebRTC Service:"
[ -f client/src/services/webrtc.js ] && echo "OK webrtc.js exists" || echo "ERROR webrtc.js missing"

echo "Connection Config:"
[ -f client/src/config/connection.js ] && echo "OK connection.js exists" || echo "ERROR connection.js missing"

echo "Integration Component:"
[ -f integration-client-components/VideoCallIntegration.jsx ] && echo "OK VideoCallIntegration.jsx exists" || echo "ERROR VideoCallIntegration.jsx missing"

echo "WebRTC Hook:"
[ -f video-call-integration/client-components/hooks/useWebRTC.js ] && echo "OK useWebRTC.js exists" || echo "ERROR useWebRTC.js missing"
'@

ssh $vmConnection $verifyScript

# Step 5: Validate WebRTC configurations on VM
Write-Info "Validating WebRTC configurations on VM..."
$validateScript = @'
cd ~/video-call-translation_OFFICIAL
echo "=== Checking TURN server configurations ==="

echo "Checking connection.js for TURN servers:"
if grep -q "turn:" client/src/config/connection.js 2>/dev/null; then
    echo "OK TURN servers found in connection.js"
else
    echo "WARN TURN servers not found in connection.js"
fi

echo "Checking VideoCallIntegration.jsx for TURN servers:"
if grep -q "turn:" integration-client-components/VideoCallIntegration.jsx 2>/dev/null; then
    echo "OK TURN servers found in VideoCallIntegration.jsx"
else
    echo "WARN TURN servers not found in VideoCallIntegration.jsx"
fi

echo "Checking useWebRTC.js for TURN servers:"
if grep -q "turn:" video-call-integration/client-components/hooks/useWebRTC.js 2>/dev/null; then
    echo "OK TURN servers found in useWebRTC.js"
else
    echo "WARN TURN servers not found in useWebRTC.js"
fi

echo "Checking socket server for ICE candidate handling:"
if grep -q "handleIceCandidate" server/socket/server.js 2>/dev/null; then
    echo "OK ICE candidate handling found"
else
    echo "WARN ICE candidate handling not found"
fi

echo "Checking socket controller for ICE candidate function:"
if grep -q "handleIceCandidate" server/socket/socketController.js 2>/dev/null; then
    echo "OK ICE candidate function found"
else
    echo "WARN ICE candidate function not found"
fi
'@

ssh $vmConnection $validateScript

# Step 6: Deploy both systems
Write-Info "Deploying both systems on VM..."
$deployScript = @'
cd ~/video-call-translation_OFFICIAL

echo "=== Stopping existing containers ==="
sudo docker-compose -f docker-compose.production.yml down 2>/dev/null || echo "Main system was not running"

if [ -d video-call-integration ]; then
    cd video-call-integration
    sudo docker-compose -f docker-compose.standalone.yml down 2>/dev/null || echo "Integration system was not running"
    cd ..
fi

echo "=== Creating SSL certificates if needed ==="
mkdir -p nginx/ssl
if [ ! -f nginx/ssl/selfsigned.crt ]; then
    echo "Creating SSL certificates..."
    sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout nginx/ssl/selfsigned.key \
        -out nginx/ssl/selfsigned.crt \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=34.142.175.163"
    echo "OK SSL certificates created"
else
    echo "OK SSL certificates already exist"
fi

echo "=== Building and starting main system ==="
sudo docker-compose -f docker-compose.production.yml up -d --build

if [ -d video-call-integration ]; then
    echo "=== Building and starting integration system ==="
    cd video-call-integration
    sudo docker-compose -f docker-compose.standalone.yml up -d --build
    cd ..
fi

echo "=== Waiting for services to start ==="
sleep 30

echo "=== Checking running containers ==="
sudo docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
'@

ssh $vmConnection $deployScript

# Step 7: Health checks
Write-Info "Performing health checks..."
$healthScript = @'
echo "=== Testing service endpoints ==="

echo "Testing main client (port 8080):"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:8080 | grep -q "200\|301\|302"; then
    echo "OK Main client responding"
else
    echo "WARN Main client not responding"
fi

echo "Testing API (port 5000):"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5000 | grep -q "200\|301\|302"; then
    echo "OK API responding"
else
    echo "WARN API not responding"
fi

echo "Testing Socket.IO (port 4000):"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:4000 | grep -q "200\|301\|302"; then
    echo "OK Socket.IO responding"
else
    echo "WARN Socket.IO not responding"
fi

echo "Testing integration nginx (port 3080):"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3080 | grep -q "200\|301\|302"; then
    echo "OK Integration nginx responding"
else
    echo "WARN Integration nginx not responding"
fi

echo "Testing integration server (port 3001):"
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3001 | grep -q "200\|301\|302"; then
    echo "OK Integration server responding"
else
    echo "WARN Integration server not responding"
fi
'@

ssh $vmConnection $healthScript

# Step 8: Test TURN server connectivity from VM
Write-Info "Testing TURN server connectivity from VM..."
$turnScript = @'
echo "Testing TURN server connectivity..."
if timeout 5 bash -c 'echo > /dev/tcp/openrelay.metered.ca/80' 2>/dev/null; then
    echo "OK openrelay.metered.ca:80 reachable"
else
    echo "ERROR openrelay.metered.ca:80 unreachable"
fi

if timeout 5 bash -c 'echo > /dev/tcp/openrelay.metered.ca/443' 2>/dev/null; then
    echo "OK openrelay.metered.ca:443 reachable"
else
    echo "ERROR openrelay.metered.ca:443 unreachable"
fi

if timeout 5 bash -c 'echo > /dev/tcp/openrelay.metered.ca/3478' 2>/dev/null; then
    echo "OK openrelay.metered.ca:3478 reachable"
else
    echo "ERROR openrelay.metered.ca:3478 unreachable"
fi
'@

ssh $vmConnection $turnScript

# Final summary
Write-Host ""
Write-Host "DEPLOYMENT SUMMARY FOR VM 34.142.175.163" -ForegroundColor Blue
Write-Host "=" * 60 -ForegroundColor Blue

Write-Host ""
Write-Host "SYSTEM 1: Main Translation System" -ForegroundColor Cyan
Write-Host "   Purpose: Direct video calls with real-time translation" -ForegroundColor White
Write-Host "   URL: http://34.142.175.163:8080" -ForegroundColor Green
Write-Host "   API: http://34.142.175.163:5000" -ForegroundColor Green
Write-Host "   Socket: http://34.142.175.163:4000" -ForegroundColor Green

Write-Host ""
Write-Host "SYSTEM 2: Integration System" -ForegroundColor Cyan
Write-Host "   Purpose: Components for external React websites" -ForegroundColor White
Write-Host "   Nginx: http://34.142.175.163:3080" -ForegroundColor Green
Write-Host "   Direct: http://34.142.175.163:3001" -ForegroundColor Green

Write-Host ""
Write-Host "WebRTC Enhancements Applied:" -ForegroundColor Yellow
Write-Host "   - TURN servers for NAT traversal" -ForegroundColor Green
Write-Host "   - Enhanced ICE candidate exchange" -ForegroundColor Green
Write-Host "   - Improved signaling mechanisms" -ForegroundColor Green
Write-Host "   - Cross-network connectivity support" -ForegroundColor Green

Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Cyan
Write-Host "   1. Test video calls from different networks" -ForegroundColor White
Write-Host "   2. Monitor browser console for WebRTC logs" -ForegroundColor White
Write-Host "   3. Check ICE candidate gathering" -ForegroundColor White
Write-Host "   4. Verify TURN server usage in WebRTC stats" -ForegroundColor White

Write-Success ""
Write-Success "WebRTC deployment completed successfully!"
Write-Info "Both systems are now enhanced for cross-network video calling."

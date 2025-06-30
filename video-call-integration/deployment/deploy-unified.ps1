# Video Call Integration - PowerShell Unified Deployment
# Triển khai tích hợp với hệ thống translation hiện có

param(
    [string]$VMHost = "34.142.175.163",
    [string]$VMUser = "root",
    [string]$IntegrationPath = "/opt/video-call-integration",
    [string]$OriginalPath = "/opt/video-call-translation"
)

function Write-Status($message) {
    Write-Host "📋 $message" -ForegroundColor Yellow
}

function Write-Success($message) {
    Write-Host "✅ $message" -ForegroundColor Green
}

function Write-Error($message) {
    Write-Host "❌ $message" -ForegroundColor Red
}

function Write-Info($message) {
    Write-Host "ℹ️  $message" -ForegroundColor Blue
}

Write-Host "🚀 Video Call Integration - Unified Deployment" -ForegroundColor Green
Write-Host "=============================================="

# Check if integration directory exists
if (-not (Test-Path "./video-call-integration")) {
    Write-Error "Video call integration directory not found"
    exit 1
}

Write-Status "Testing VM connection..."
$connectionTest = ssh -o ConnectTimeout=10 "$VMUser@$VMHost" "echo 'Connected successfully'" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Error "Cannot connect to VM: $VMHost"
    exit 1
}
Write-Success "VM connection established"

Write-Status "Checking existing translation system..."
$translationExists = ssh "$VMUser@$VMHost" "[ -d '$OriginalPath' ] && echo 'exists' || echo 'not_exists'"
if ($translationExists -eq "exists") {
    Write-Success "Existing translation system found at $OriginalPath"
} else {
    Write-Info "No existing translation system found. Will deploy standalone."
}

Write-Status "Creating integration directory..."
ssh "$VMUser@$VMHost" "mkdir -p $IntegrationPath && chown $VMUser`:$VMUser $IntegrationPath"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create integration directory"
    exit 1
}
Write-Success "Integration directory created"

Write-Status "Uploading integration files..."
rsync -avz --exclude node_modules --exclude .env --progress "./video-call-integration/" "$VMUser@$VMHost`:$IntegrationPath/"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to upload integration files"
    exit 1
}
Write-Success "Integration files uploaded"

Write-Status "Setting up environment configuration..."
$envContent = @"
# Database Configuration
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=hommy_database

# JWT Configuration
JWT_SECRET=$(ssh "$VMUser@$VMHost" "openssl rand -base64 32")
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
LOG_FILE=$IntegrationPath/logs/server.log
"@

$envContent | ssh "$VMUser@$VMHost" "cat > $IntegrationPath/.env"
Write-Success "Environment configuration created"

Write-Status "Installing dependencies..."
ssh "$VMUser@$VMHost" "cd $IntegrationPath/server && npm install --production"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to install dependencies"
    exit 1
}
Write-Success "Dependencies installed"

Write-Status "Setting up database..."
ssh "$VMUser@$VMHost" "cd $IntegrationPath && node database/setup.js"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to setup database"
    exit 1
}
Write-Success "Database setup completed"

Write-Status "Creating logs directory..."
ssh "$VMUser@$VMHost" "mkdir -p $IntegrationPath/logs && chown $VMUser`:$VMUser $IntegrationPath/logs"
Write-Success "Logs directory created"

Write-Status "Creating systemd service..."
$serviceContent = @"
[Unit]
Description=Video Call Integration Server
After=network.target mysql.service
Wants=video-call-translation.service

[Service]
Type=simple
User=$VMUser
WorkingDirectory=$IntegrationPath/server
ExecStart=/usr/bin/node integrationServer.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

# Logging
StandardOutput=append:$IntegrationPath/logs/server.log
StandardError=append:$IntegrationPath/logs/error.log

[Install]
WantedBy=multi-user.target
"@

$serviceContent | ssh "$VMUser@$VMHost" "cat > /etc/systemd/system/video-call-integration.service"
Write-Success "Systemd service created"

Write-Status "Updating nginx configuration..."
if ($translationExists -eq "exists") {
    ssh "$VMUser@$VMHost" @"
# Backup existing nginx config
cp /etc/nginx/nginx.conf /etc/nginx/nginx.conf.backup.`$(date +%Y%m%d_%H%M%S)

# Copy new unified nginx config
cp $IntegrationPath/nginx/nginx.conf /etc/nginx/nginx.conf

# Test nginx configuration
nginx -t
"@
    Write-Success "Nginx configuration updated"
} else {
    Write-Info "Installing nginx for standalone deployment..."
    ssh "$VMUser@$VMHost" @"
apt-get update
apt-get install -y nginx
cp $IntegrationPath/nginx/nginx.conf /etc/nginx/nginx.conf
systemctl enable nginx
nginx -t
"@
    Write-Success "Nginx installed and configured"
}

Write-Status "Setting up SSL certificates..."
ssh "$VMUser@$VMHost" @"
mkdir -p /etc/nginx/ssl
if [ ! -f /etc/nginx/ssl/certificate.crt ]; then
    openssl req -x509 -newkey rsa:4096 -keyout /etc/nginx/ssl/private.key -out /etc/nginx/ssl/certificate.crt -days 365 -nodes -subj '/C=VN/ST=State/L=City/O=Organization/OU=IT/CN=34.142.175.163'
    chmod 600 /etc/nginx/ssl/private.key
    chmod 644 /etc/nginx/ssl/certificate.crt
fi
"@
Write-Success "SSL certificates configured"

Write-Status "Configuring firewall..."
ssh "$VMUser@$VMHost" @"
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3001/tcp
ufw --force enable
"@ 2>$null
Write-Success "Firewall configured"

Write-Status "Starting services..."
ssh "$VMUser@$VMHost" @"
systemctl daemon-reload
systemctl enable video-call-integration
systemctl start video-call-integration
systemctl restart nginx
"@
Write-Success "Services started"

Write-Status "Checking service status..."
Start-Sleep -Seconds 5

$serviceStatus = ssh "$VMUser@$VMHost" "systemctl is-active video-call-integration"
$nginxStatus = ssh "$VMUser@$VMHost" "systemctl is-active nginx"

if ($serviceStatus -eq "active") {
    Write-Success "Video Call Integration service is running"
} else {
    Write-Error "Video Call Integration service failed. Status: $serviceStatus"
    ssh "$VMUser@$VMHost" "journalctl -u video-call-integration --no-pager -n 20"
}

if ($nginxStatus -eq "active") {
    Write-Success "Nginx is running"
} else {
    Write-Error "Nginx failed. Status: $nginxStatus"
}

Write-Status "Testing API endpoints..."
Start-Sleep -Seconds 5

# Test video call integration API
ssh "$VMUser@$VMHost" "curl -k -s https://localhost/video-call-api/health" 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Success "Video Call Integration API is responding"
} else {
    Write-Error "Video Call Integration API is not responding"
}

# Test existing translation API if present
if ($translationExists -eq "exists") {
    ssh "$VMUser@$VMHost" "curl -k -s https://localhost/api/health" 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Translation API is responding"
    } else {
        Write-Error "Translation API is not responding"
    }
}

Write-Host ""
Write-Host "🎉 Unified Deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 System URLs:"
Write-Host "   Main Website: https://34.142.175.163"
Write-Host "   Video Call API: https://34.142.175.163/video-call-api"
Write-Host "   Video Call WebSocket: wss://34.142.175.163/video-call-socket.io"
if ($translationExists -eq "exists") {
    Write-Host "   Translation API: https://34.142.175.163/api"
    Write-Host "   Translation WebSocket: wss://34.142.175.163/socket.io"
}
Write-Host ""
Write-Host "🔧 Management Commands:"
Write-Host "   Video Call Service:"
Write-Host "     Start:   systemctl start video-call-integration"
Write-Host "     Stop:    systemctl stop video-call-integration"
Write-Host "     Restart: systemctl restart video-call-integration"
Write-Host "     Status:  systemctl status video-call-integration"
Write-Host "     Logs:    journalctl -u video-call-integration -f"
Write-Host ""
Write-Host "   Nginx:"
Write-Host "     Restart: systemctl restart nginx"
Write-Host "     Status:  systemctl status nginx"
Write-Host "     Test:    nginx -t"
Write-Host ""
Write-Host "📋 Next Steps:"
Write-Host "   1. Copy client-components to your React project"
Write-Host "   2. Configure client to use https://34.142.175.163"
Write-Host "   3. Test the integration"
Write-Host ""
if ($translationExists -eq "exists") {
    Write-Host "✨ Integration with existing translation system completed!" -ForegroundColor Green
} else {
    Write-Host "✨ Standalone video call system deployed!" -ForegroundColor Green
}

# Video Call Integration - PowerShell Deployment Script
# Triển khai server components lên VM: 34.142.175.163

param(
    [string]$VMHost = "34.142.175.163",
    [string]$VMUser = "hopboy553",
    [string]$VMPath = "/home/hopboy553/video-call-translation_OFFICIAL/video-call-integration",
    [string]$LocalServerPath = "./server"
)

# Colors for output
function Write-Status($message) {
    Write-Host "📋 $message" -ForegroundColor Yellow
}

function Write-Success($message) {
    Write-Host "✅ $message" -ForegroundColor Green
}

function Write-Error($message) {
    Write-Host "❌ $message" -ForegroundColor Red
}

Write-Host "🚀 Video Call Integration - Server Deployment" -ForegroundColor Green
Write-Host "===========================================" -ForegroundColor Green

# Check if server directory exists
if (-not (Test-Path $LocalServerPath)) {
    Write-Error "Server directory not found: $LocalServerPath"
    exit 1
}

Write-Status "Checking requirements..."

# Check if ssh is available
try {
    ssh -V 2>$null | Out-Null
    Write-Success "SSH is available"
} catch {
    Write-Error "SSH is not available. Please install OpenSSH client."
    exit 1
}

# Check if rsync is available (or use SCP as fallback)
$useRsync = $true
try {
    rsync --version 2>$null | Out-Null
    Write-Success "Rsync is available"
} catch {
    Write-Status "Rsync not available, will use SCP as fallback"
    $useRsync = $false
}

Write-Status "Testing VM connection..."
$connectionTest = ssh -o ConnectTimeout=10 "$VMUser@$VMHost" "echo 'Connected successfully'" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Error "Cannot connect to VM: $VMHost"
    exit 1
}
Write-Success "VM connection established"

Write-Status "Creating deployment directory on VM..."
ssh "$VMUser@$VMHost" "mkdir -p $VMPath && mkdir -p $VMPath/logs"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create deployment directory"
    exit 1
}
Write-Success "Deployment directory created"

Write-Status "Uploading server files..."
if ($useRsync) {
    # Use rsync if available
    rsync -avz --exclude node_modules --exclude .env --progress "$LocalServerPath/" "$VMUser@$VMHost`:$VMPath/"
} else {
    # Fallback to scp
    scp -r "$LocalServerPath/*" "$VMUser@$VMHost`:$VMPath/"
}
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to upload server files"
    exit 1
}
Write-Success "Server files uploaded"

Write-Status "Creating environment file..."
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
ALLOWED_ORIGINS=https://34.126.167.181,http://localhost:3000,https://localhost:3000

# WebRTC Configuration
STUN_SERVER=stun:stun.l.google.com:19302

# Logging
LOG_LEVEL=info
LOG_FILE=/home/hopboy553/video-call-translation_OFFICIAL/video-call-integration/logs/server.log
"@

$envContent | ssh "$VMUser@$VMHost" "cat > $VMPath/.env"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create environment file"
    exit 1
}
Write-Success "Environment file created"

Write-Status "Installing Node.js dependencies..."
ssh "$VMUser@$VMHost" "cd $VMPath && npm install --production"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to install dependencies"
    exit 1
}
Write-Success "Dependencies installed"

Write-Status "Setting up database..."
ssh "$VMUser@$VMHost" "cd $VMPath && node database/setup.js"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to setup database"
    exit 1
}
Write-Success "Database setup completed"

Write-Status "Creating systemd service..."
$serviceContent = @"
[Unit]
Description=Video Call Integration Server
After=network.target mysql.service

[Service]
Type=simple
User=$VMUser
WorkingDirectory=$VMPath
ExecStart=/usr/bin/node integrationServer.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

# Logging
StandardOutput=append:/home/hopboy553/video-call-translation_OFFICIAL/video-call-integration/logs/server.log
StandardError=append:/home/hopboy553/video-call-translation_OFFICIAL/video-call-integration/logs/error.log

[Install]
WantedBy=multi-user.target
"@

# Create service file with sudo
$serviceContent | ssh "$VMUser@$VMHost" "sudo tee /etc/systemd/system/video-call-integration.service > /dev/null"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to create systemd service"
    exit 1
}
Write-Success "Systemd service created"

Write-Status "Creating logs directory..."
ssh "$VMUser@$VMHost" "mkdir -p $VMPath/logs"
Write-Success "Logs directory created"

Write-Status "Enabling and starting service..."
ssh "$VMUser@$VMHost" "sudo systemctl daemon-reload && sudo systemctl enable video-call-integration && sudo systemctl start video-call-integration"
if ($LASTEXITCODE -ne 0) {
    Write-Error "Failed to start service"
    exit 1
}
Write-Success "Service started"

Write-Status "Configuring firewall..."
ssh "$VMUser@$VMHost" "sudo ufw allow 3001/tcp" 2>$null
Write-Success "Firewall configured"

Write-Status "Setting up SSL certificate..."
ssh "$VMUser@$VMHost" @"
if [ ! -f /etc/ssl/certs/video-call-integration.crt ]; then
    sudo openssl req -x509 -newkey rsa:4096 -keyout /etc/ssl/private/video-call-integration.key -out /etc/ssl/certs/video-call-integration.crt -days 365 -nodes -subj '/C=VN/ST=State/L=City/O=Organization/OU=IT/CN=34.126.167.181'
    sudo chmod 600 /etc/ssl/private/video-call-integration.key
    sudo chmod 644 /etc/ssl/certs/video-call-integration.crt
fi
"@
Write-Success "SSL certificate configured"

Write-Status "Checking service status..."
Start-Sleep -Seconds 5
$serviceStatus = ssh "$VMUser@$VMHost" "sudo systemctl is-active video-call-integration"
if ($serviceStatus -eq "active") {
    Write-Success "Service is running successfully"
} else {
    Write-Error "Service is not running. Status: $serviceStatus"
    ssh "$VMUser@$VMHost" "sudo journalctl -u video-call-integration --no-pager -n 20"
}

Write-Status "Testing API endpoint..."
Start-Sleep -Seconds 5
ssh "$VMUser@$VMHost" "curl -k -s https://localhost:3001/api/health" 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Success "API endpoint is responding"
} else {
    Write-Error "API endpoint is not responding"
}

Write-Host ""
Write-Host "🎉 Deployment completed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📍 Server Details:"
Write-Host "   URL: https://34.126.167.181:3001"
Write-Host "   WebSocket: wss://34.126.167.181:3001"
Write-Host "   Service: sudo systemctl status video-call-integration"
Write-Host "   Logs: tail -f $VMPath/logs/server.log"
Write-Host ""
Write-Host "📋 Next Steps:"
Write-Host "   1. Copy client components to your React project"
Write-Host "   2. Configure client to connect to https://34.126.167.181:3001"
Write-Host "   3. Test the integration"
Write-Host ""
Write-Host "🔧 Management Commands:"
Write-Host "   Start:   sudo systemctl start video-call-integration"
Write-Host "   Stop:    sudo systemctl stop video-call-integration"
Write-Host "   Restart: sudo systemctl restart video-call-integration"
Write-Host "   Status:  sudo systemctl status video-call-integration"
Write-Host "   Logs:    sudo journalctl -u video-call-integration -f"

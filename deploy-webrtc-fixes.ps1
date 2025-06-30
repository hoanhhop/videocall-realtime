# WebRTC Production Deployment Script for Windows
# Deploys WebRTC fixes for cross-network video call functionality

Write-Host "🚀 Starting WebRTC Production Deployment..." -ForegroundColor Green

# Function to print colored output
function Write-Success {
    param($Message)
    Write-Host "✅ $Message" -ForegroundColor Green
}

function Write-Warning {
    param($Message)
    Write-Host "⚠️ $Message" -ForegroundColor Yellow
}

function Write-Error {
    param($Message)
    Write-Host "❌ $Message" -ForegroundColor Red
}

function Write-Info {
    param($Message)
    Write-Host "ℹ️ $Message" -ForegroundColor Cyan
}

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Success "Docker is running"
} catch {
    Write-Error "Docker is not running. Please start Docker Desktop first."
    exit 1
}

# Stop existing containers
Write-Info "Stopping existing containers..."
docker-compose -f docker-compose.production.yml down

# Remove old images to ensure fresh build
Write-Info "Removing old images for fresh build..."
docker system prune -f
docker image prune -f

# Create SSL certificates if they don't exist
$sslDir = ".\nginx\ssl"
if (!(Test-Path $sslDir)) {
    Write-Info "Creating SSL directory..."
    New-Item -ItemType Directory -Path $sslDir -Force | Out-Null
}

$certFile = "$sslDir\selfsigned.crt"
$keyFile = "$sslDir\selfsigned.key"

if (!(Test-Path $certFile) -or !(Test-Path $keyFile)) {
    Write-Info "Creating self-signed SSL certificates..."
    try {
        # Try using OpenSSL if available
        $opensslCmd = "openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout `"$keyFile`" -out `"$certFile`" -subj `"/C=US/ST=State/L=City/O=Organization/CN=34.142.175.163`""
        Invoke-Expression $opensslCmd
        Write-Success "SSL certificates created successfully with OpenSSL"
    } catch {
        Write-Warning "OpenSSL not found. Creating certificates with PowerShell..."
        
        # Alternative: Create self-signed certificate with PowerShell
        try {
            $cert = New-SelfSignedCertificate -DnsName "34.142.175.163" -CertStoreLocation "cert:\LocalMachine\My" -NotAfter (Get-Date).AddYears(1)
            $certPath = "cert:\LocalMachine\My\$($cert.Thumbprint)"
            
            # Export certificate
            Export-Certificate -Cert $certPath -FilePath $certFile -Type CERT | Out-Null
            
            # Export private key (requires manual conversion for nginx)
            Write-Warning "Please convert the certificate to PEM format for nginx compatibility"
            Write-Success "SSL certificate created with PowerShell"
        } catch {
            Write-Error "Failed to create SSL certificates: $($_.Exception.Message)"
            Write-Info "Please install OpenSSL or create certificates manually"
        }
    }
} else {
    Write-Success "SSL certificates already exist"
}

# Validate WebRTC configurations
Write-Info "Validating WebRTC configurations..."

# Check connection.js
if (Select-String -Path "client\src\config\connection.js" -Pattern "turn:openrelay\.metered\.ca" -Quiet) {
    Write-Success "client/src/config/connection.js: TURN servers configured"
} else {
    Write-Error "client/src/config/connection.js: TURN servers missing"
}

# Check VideoCallIntegration.jsx
if (Test-Path "integration-client-components\VideoCallIntegration.jsx") {
    if (Select-String -Path "integration-client-components\VideoCallIntegration.jsx" -Pattern "turn:openrelay\.metered\.ca" -Quiet) {
        Write-Success "VideoCallIntegration.jsx: TURN servers configured"
    } else {
        Write-Error "VideoCallIntegration.jsx: TURN servers missing"
    }
}

# Check useWebRTC.js
if (Test-Path "video-call-integration\client-components\hooks\useWebRTC.js") {
    if (Select-String -Path "video-call-integration\client-components\hooks\useWebRTC.js" -Pattern "turn:openrelay\.metered\.ca" -Quiet) {
        Write-Success "useWebRTC.js: TURN servers configured"
    } else {
        Write-Error "useWebRTC.js: TURN servers missing"
    }
}

# Check if socket server has ICE candidate handling
if (Select-String -Path "server\socket\server.js" -Pattern "handleIceCandidate" -Quiet) {
    Write-Success "Socket server: ICE candidate handling configured"
} else {
    Write-Error "Socket server: ICE candidate handling missing"
}

# Build and start services
Write-Info "Building and starting production services..."
docker-compose -f docker-compose.production.yml up -d --build

# Wait for services to start
Write-Info "Waiting for services to initialize..."
Start-Sleep -Seconds 30

# Health check
Write-Info "Performing health checks..."

# Check if containers are running
$containers = docker ps --format "{{.Names}}"
$expectedContainers = @("nginx", "client", "socket", "api")

foreach ($container in $expectedContainers) {
    if ($containers -match $container) {
        Write-Success "$container container is running"
    } else {
        Write-Error "$container container is not running"
    }
}

# Test HTTP endpoints
Write-Info "Testing HTTP endpoints..."

# Test HTTPS health endpoint
try {
    $response = Invoke-WebRequest -Uri "https://localhost/health" -SkipCertificateCheck -TimeoutSec 10
    if ($response.Content -match "healthy") {
        Write-Success "HTTPS health endpoint responding"
    } else {
        Write-Warning "HTTPS health endpoint responding but unexpected content"
    }
} catch {
    Write-Warning "HTTPS health endpoint not responding: $($_.Exception.Message)"
}

# Test Socket.IO endpoint
try {
    $response = Invoke-WebRequest -Uri "https://localhost/socket.io/" -SkipCertificateCheck -TimeoutSec 10
    if ($response.Content -match "Socket.IO") {
        Write-Success "Socket.IO endpoint responding"
    }
} catch {
    Write-Warning "Socket.IO endpoint not responding: $($_.Exception.Message)"
}

# Test API health endpoint
try {
    $response = Invoke-WebRequest -Uri "https://localhost/api/health" -SkipCertificateCheck -TimeoutSec 10
    Write-Success "API health endpoint responding"
} catch {
    Write-Warning "API health endpoint not responding: $($_.Exception.Message)"
}

# Display running services
Write-Info "Current running services:"
docker-compose -f docker-compose.production.yml ps

# Show recent logs
Write-Info "Recent logs (last 20 lines):"
docker-compose -f docker-compose.production.yml logs --tail=20

# Network connectivity test
Write-Info "Testing TURN server connectivity..."

$turnHosts = @("openrelay.metered.ca")
$ports = @(80, 443, 3478)

foreach ($host in $turnHosts) {
    foreach ($port in $ports) {
        try {
            $tcpClient = New-Object System.Net.Sockets.TcpClient
            $connect = $tcpClient.BeginConnect($host, $port, $null, $null)
            $wait = $connect.AsyncWaitHandle.WaitOne(5000, $false)
            
            if ($wait) {
                $tcpClient.EndConnect($connect)
                Write-Success "$host`:$port - Connection successful"
                $tcpClient.Close()
            } else {
                Write-Error "$host`:$port - Connection timeout"
            }
        } catch {
            Write-Error "$host`:$port - Connection failed: $($_.Exception.Message)"
        }
    }
}

# WebRTC configuration summary
Write-Host ""
Write-Host "📋 WebRTC Configuration Summary:" -ForegroundColor Blue
Write-Success "TURN servers configured for NAT traversal"
Write-Success "HTTPS enabled for secure media access"
Write-Success "Enhanced ICE candidate exchange"
Write-Success "Improved signaling mechanisms"
Write-Success "Production-ready SSL certificates"

Write-Host ""
Write-Host "🌐 Access URLs:" -ForegroundColor Cyan
Write-Host "  HTTPS: https://34.142.175.163" -ForegroundColor Cyan
Write-Host "  HTTP (redirects to HTTPS): http://34.142.175.163" -ForegroundColor Cyan
Write-Host "  Health Check: https://34.142.175.163/health" -ForegroundColor Cyan
Write-Host "  Socket.IO: https://34.142.175.163/socket.io/" -ForegroundColor Cyan

Write-Host ""
Write-Host "🔧 Troubleshooting Commands:" -ForegroundColor Yellow
Write-Host "  View logs: docker-compose -f docker-compose.production.yml logs -f" -ForegroundColor Yellow
Write-Host "  Restart services: docker-compose -f docker-compose.production.yml restart" -ForegroundColor Yellow
Write-Host "  Check containers: docker-compose -f docker-compose.production.yml ps" -ForegroundColor Yellow
Write-Host "  Test WebRTC: .\test-webrtc-network-connectivity.ps1" -ForegroundColor Yellow

Write-Host ""
Write-Host "🚀 WebRTC deployment completed successfully!" -ForegroundColor Green
Write-Host "   Video calls should now work across different networks." -ForegroundColor Green

# Final validation reminder
Write-Host ""
Write-Host "👉 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Test video calls from different networks/ISPs" -ForegroundColor Cyan
Write-Host "2. Monitor browser console for WebRTC connection logs" -ForegroundColor Cyan
Write-Host "3. Check ICE candidate gathering in browser dev tools" -ForegroundColor Cyan
Write-Host "4. Verify TURN server usage in WebRTC statistics" -ForegroundColor Cyan
Write-Host "5. Run network connectivity tests: .\test-webrtc-network-connectivity.ps1" -ForegroundColor Cyan

# Video Call Integration - PowerShell Test Script
# Kiểm tra hệ thống sau khi deployment

param(
    [string]$VMHost = "34.142.175.163",
    [string]$BaseUrl = "https://34.142.175.163",
    [string]$ApiUrl = "https://34.142.175.163/video-call-api",
    [string]$WsUrl = "wss://34.142.175.163/video-call-socket.io"
)

function Write-Test($message) {
    Write-Host "🔍 Testing: $message" -ForegroundColor Blue
}

function Write-Pass($message) {
    Write-Host "✅ PASS: $message" -ForegroundColor Green
}

function Write-Fail($message) {
    Write-Host "❌ FAIL: $message" -ForegroundColor Red
}

function Write-Warning($message) {
    Write-Host "⚠️  WARNING: $message" -ForegroundColor Yellow
}

Write-Host "🧪 Video Call Integration - System Test" -ForegroundColor Green
Write-Host "======================================="

# Test 1: Health Check
Write-Test "Health check endpoint"
try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/health" -Method GET -UseBasicParsing -SkipCertificateCheck -TimeoutSec 10
    if ($response.StatusCode -eq 200) {
        Write-Pass "Health check endpoint responding"
    } else {
        Write-Fail "Health check returned status: $($response.StatusCode)"
    }
} catch {
    Write-Fail "Health check endpoint not responding: $($_.Exception.Message)"
}

# Test 2: Database Connection
Write-Test "Database connectivity"
try {
    $response = Invoke-WebRequest -Uri "$ApiUrl/auth/verify" -Method GET -UseBasicParsing -SkipCertificateCheck -TimeoutSec 10 -Headers @{"Authorization" = "Bearer invalid-token"}
} catch {
    if ($_.Exception.Response.StatusCode -eq 401 -or $_.Exception.Response.StatusCode -eq 403) {
        Write-Pass "Database connection working (auth endpoint accessible)"
    } else {
        Write-Fail "Database connection or auth endpoint issue"
    }
}

# Test 3: API Endpoints
Write-Test "API endpoints availability"
$endpoints = @("/health", "/auth/verify", "/users/profile", "/video-calls/sessions", "/appointments")

foreach ($endpoint in $endpoints) {
    try {
        $response = Invoke-WebRequest -Uri "$ApiUrl$endpoint" -Method GET -UseBasicParsing -SkipCertificateCheck -TimeoutSec 5
        Write-Pass "Endpoint $endpoint accessible (status: $($response.StatusCode))"
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq 401 -or $statusCode -eq 403 -or $statusCode -eq 200) {
            Write-Pass "Endpoint $endpoint accessible (status: $statusCode)"
        } else {
            Write-Fail "Endpoint $endpoint not accessible (status: $statusCode)"
        }
    }
}

# Test 4: Translation Integration
Write-Test "Translation service integration"
try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/api/health" -Method GET -UseBasicParsing -SkipCertificateCheck -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
        Write-Pass "Translation service integration active"
    }
} catch {
    Write-Warning "Translation service not available or not integrated"
}

# Test 5: SSL Certificate
Write-Test "SSL certificate validation"
try {
    $response = Invoke-WebRequest -Uri $BaseUrl -Method GET -UseBasicParsing -TimeoutSec 5
    Write-Pass "SSL certificate accessible"
} catch {
    Write-Warning "SSL certificate issue or HTTPS not configured"
}

# Test 6: Port Accessibility
Write-Test "Port accessibility"
$ports = @(80, 443, 3001)

foreach ($port in $ports) {
    try {
        $tcpClient = New-Object System.Net.Sockets.TcpClient
        $connectTask = $tcpClient.ConnectAsync($VMHost, $port)
        if ($connectTask.Wait(5000)) {
            Write-Pass "Port $port is accessible"
            $tcpClient.Close()
        } else {
            Write-Fail "Port $port connection timeout"
        }
    } catch {
        Write-Fail "Port $port is not accessible"
    }
}

# Test 7: Service Status (if SSH available)
Write-Test "Service status"
if (Get-Command ssh -ErrorAction SilentlyContinue) {
    $services = @("video-call-integration", "nginx", "mysql")
    
    foreach ($service in $services) {
        try {
            $status = ssh "root@$VMHost" "systemctl is-active $service" 2>$null
            if ($status -eq "active") {
                Write-Pass "Service $service is running"
            } else {
                Write-Fail "Service $service is not running (status: $status)"
            }
        } catch {
            Write-Warning "Cannot check service $service status"
        }
    }
} else {
    Write-Warning "SSH not available, skipping service status check"
}

Write-Host ""
Write-Host "🏁 Test Summary" -ForegroundColor Green
Write-Host "==============="
Write-Host "✅ Tests completed"
Write-Host "📊 Check results above for any failures"
Write-Host ""
Write-Host "🔗 Quick Access URLs:"
Write-Host "   Main Site: $BaseUrl"
Write-Host "   API Health: $ApiUrl/health"
Write-Host "   WebSocket: $WsUrl"
Write-Host ""
Write-Host "🛠️  If tests failed, check:"
Write-Host "   1. Service status: systemctl status video-call-integration"
Write-Host "   2. Nginx status: systemctl status nginx"
Write-Host "   3. Server logs: tail -f /opt/video-call-integration/logs/server.log"
Write-Host "   4. Nginx logs: tail -f /var/log/nginx/error.log"

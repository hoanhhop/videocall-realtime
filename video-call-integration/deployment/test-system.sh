#!/bin/bash

# Video Call Integration - Test Script
# Kiểm tra hệ thống sau khi deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
VM_HOST="34.142.175.163"
BASE_URL="https://$VM_HOST"
API_URL="$BASE_URL/video-call-api"
WS_URL="wss://$VM_HOST/video-call-socket.io"

echo -e "${GREEN}🧪 Video Call Integration - System Test${NC}"
echo "========================================="

print_test() {
    echo -e "${BLUE}🔍 Testing: $1${NC}"
}

print_pass() {
    echo -e "${GREEN}✅ PASS: $1${NC}"
}

print_fail() {
    echo -e "${RED}❌ FAIL: $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  WARNING: $1${NC}"
}

# Test 1: Health Check
print_test "Health check endpoint"
if curl -k -s "$API_URL/health" | grep -q "healthy\|ok"; then
    print_pass "Health check endpoint responding"
else
    print_fail "Health check endpoint not responding"
fi

# Test 2: Database Connection
print_test "Database connectivity"
response=$(curl -k -s "$API_URL/auth/verify" -H "Authorization: Bearer invalid-token" -w "%{http_code}")
if [[ "$response" == *"401"* || "$response" == *"403"* ]]; then
    print_pass "Database connection working (auth endpoint accessible)"
else
    print_fail "Database connection or auth endpoint issue"
fi

# Test 3: WebSocket Connection
print_test "WebSocket connectivity"
if command -v wscat &> /dev/null; then
    timeout 10s wscat -c "$WS_URL" -x '{"type":"ping"}' &> /dev/null
    if [ $? -eq 0 ]; then
        print_pass "WebSocket connection successful"
    else
        print_fail "WebSocket connection failed"
    fi
else
    print_warning "wscat not installed, skipping WebSocket test"
fi

# Test 4: API Endpoints
print_test "API endpoints availability"
endpoints=(
    "/health"
    "/auth/verify"
    "/users/profile"
    "/video-calls/sessions"
    "/appointments"
)

for endpoint in "${endpoints[@]}"; do
    status_code=$(curl -k -s -o /dev/null -w "%{http_code}" "$API_URL$endpoint")
    if [[ "$status_code" =~ ^(200|401|403)$ ]]; then
        print_pass "Endpoint $endpoint accessible (status: $status_code)"
    else
        print_fail "Endpoint $endpoint not accessible (status: $status_code)"
    fi
done

# Test 5: Translation Integration (if available)
print_test "Translation service integration"
translation_status=$(curl -k -s "$BASE_URL/api/health" -w "%{http_code}" 2>/dev/null | tail -n1)
if [[ "$translation_status" == "200" ]]; then
    print_pass "Translation service integration active"
else
    print_warning "Translation service not available or not integrated"
fi

# Test 6: SSL Certificate
print_test "SSL certificate validation"
if openssl s_client -connect "$VM_HOST:443" -servername "$VM_HOST" </dev/null 2>/dev/null | openssl x509 -noout -text | grep -q "CN=$VM_HOST"; then
    print_pass "SSL certificate valid"
else
    print_warning "SSL certificate issue (self-signed or invalid)"
fi

# Test 7: System Resources
print_test "System resources"
if command -v ssh &> /dev/null; then
    memory_usage=$(ssh root@$VM_HOST "free | grep Mem | awk '{printf \"%.1f\", \$3/\$2 * 100.0}'")
    disk_usage=$(ssh root@$VM_HOST "df -h / | awk 'NR==2{print \$5}' | sed 's/%//'")
    
    if (( $(echo "$memory_usage < 80" | bc -l) )); then
        print_pass "Memory usage: ${memory_usage}%"
    else
        print_warning "High memory usage: ${memory_usage}%"
    fi
    
    if (( disk_usage < 80 )); then
        print_pass "Disk usage: ${disk_usage}%"
    else
        print_warning "High disk usage: ${disk_usage}%"
    fi
else
    print_warning "SSH not available, skipping system resource check"
fi

# Test 8: Service Status
print_test "Service status"
if command -v ssh &> /dev/null; then
    services=("video-call-integration" "nginx" "mysql")
    
    for service in "${services[@]}"; do
        status=$(ssh root@$VM_HOST "systemctl is-active $service" 2>/dev/null)
        if [[ "$status" == "active" ]]; then
            print_pass "Service $service is running"
        else
            print_fail "Service $service is not running (status: $status)"
        fi
    done
else
    print_warning "SSH not available, skipping service status check"
fi

# Test 9: Log Files
print_test "Log file accessibility"
if command -v ssh &> /dev/null; then
    log_files=(
        "/opt/video-call-integration/logs/server.log"
        "/var/log/nginx/access.log"
        "/var/log/nginx/error.log"
    )
    
    for log_file in "${log_files[@]}"; do
        if ssh root@$VM_HOST "[ -f '$log_file' ]" 2>/dev/null; then
            print_pass "Log file $log_file exists"
        else
            print_warning "Log file $log_file not found"
        fi
    done
else
    print_warning "SSH not available, skipping log file check"
fi

# Test 10: Port Accessibility
print_test "Port accessibility"
ports=(80 443 3001)

for port in "${ports[@]}"; do
    if timeout 5 bash -c "</dev/tcp/$VM_HOST/$port" 2>/dev/null; then
        print_pass "Port $port is accessible"
    else
        print_fail "Port $port is not accessible"
    fi
done

echo ""
echo -e "${GREEN}🏁 Test Summary${NC}"
echo "==============="
echo "✅ Tests completed"
echo "📊 Check results above for any failures"
echo ""
echo "🔗 Quick Access URLs:"
echo "   Main Site: $BASE_URL"
echo "   API Health: $API_URL/health"
echo "   WebSocket: $WS_URL"
echo ""
echo "🛠️  If tests failed, check:"
echo "   1. Service status: systemctl status video-call-integration"
echo "   2. Nginx status: systemctl status nginx"
echo "   3. Server logs: tail -f /opt/video-call-integration/logs/server.log"
echo "   4. Nginx logs: tail -f /var/log/nginx/error.log"

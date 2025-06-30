#!/bin/bash
# Video Call Integration - Copy Files Script
# Copy các file cần thiết lên VM với SSH user hopboy553

# Configuration
VM_HOST="34.126.167.181"
VM_USER="hopboy553"
VM_BASE_PATH="/home/hopboy553/video-call-translation_OFFICIAL"
LOCAL_BASE_PATH="."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

function print_status() {
    echo -e "${YELLOW}📋 $1${NC}"
}

function print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

function print_error() {
    echo -e "${RED}❌ $1${NC}"
}

echo -e "${GREEN}🚀 Video Call Integration - File Copy Script${NC}"
echo -e "${GREEN}============================================${NC}"

# Test SSH connection
print_status "Testing SSH connection..."
if ! ssh -o ConnectTimeout=10 "$VM_USER@$VM_HOST" "echo 'Connected successfully'" >/dev/null 2>&1; then
    print_error "Cannot connect to VM: $VM_HOST with user: $VM_USER"
    echo "Please check:"
    echo "1. SSH key is properly configured"
    echo "2. VM is accessible: ssh $VM_USER@$VM_HOST"
    exit 1
fi
print_success "SSH connection established"

# Create directories on VM
print_status "Creating directory structure on VM..."
ssh "$VM_USER@$VM_HOST" << EOF
mkdir -p $VM_BASE_PATH/video-call-integration/server
mkdir -p $VM_BASE_PATH/video-call-integration/database
mkdir -p $VM_BASE_PATH/video-call-integration/client-components
mkdir -p $VM_BASE_PATH/video-call-integration/deployment
mkdir -p $VM_BASE_PATH/video-call-integration/nginx
mkdir -p $VM_BASE_PATH/video-call-integration/logs
EOF

if [ $? -ne 0 ]; then
    print_error "Failed to create directories"
    exit 1
fi
print_success "Directory structure created"

# Copy server files
print_status "Copying server files..."
scp -r "$LOCAL_BASE_PATH/server/"* "$VM_USER@$VM_HOST:$VM_BASE_PATH/video-call-integration/server/"
if [ $? -ne 0 ]; then
    print_error "Failed to copy server files"
    exit 1
fi
print_success "Server files copied"

# Copy database files
print_status "Copying database files..."
scp -r "$LOCAL_BASE_PATH/database/"* "$VM_USER@$VM_HOST:$VM_BASE_PATH/video-call-integration/database/"
if [ $? -ne 0 ]; then
    print_error "Failed to copy database files"
    exit 1
fi
print_success "Database files copied"

# Copy client components
print_status "Copying client components..."
scp -r "$LOCAL_BASE_PATH/client-components/"* "$VM_USER@$VM_HOST:$VM_BASE_PATH/video-call-integration/client-components/"
if [ $? -ne 0 ]; then
    print_error "Failed to copy client components"
    exit 1
fi
print_success "Client components copied"

# Copy deployment scripts
print_status "Copying deployment scripts..."
scp -r "$LOCAL_BASE_PATH/deployment/"* "$VM_USER@$VM_HOST:$VM_BASE_PATH/video-call-integration/deployment/"
if [ $? -ne 0 ]; then
    print_error "Failed to copy deployment scripts"
    exit 1
fi
print_success "Deployment scripts copied"

# Copy nginx configuration
print_status "Copying nginx configuration..."
scp -r "$LOCAL_BASE_PATH/nginx/"* "$VM_USER@$VM_HOST:$VM_BASE_PATH/video-call-integration/nginx/"
if [ $? -ne 0 ]; then
    print_error "Failed to copy nginx configuration"
    exit 1
fi
print_success "Nginx configuration copied"

# Copy Docker Compose and README files
print_status "Copying configuration files..."
scp "$LOCAL_BASE_PATH/docker-compose.integration.yml" "$VM_USER@$VM_HOST:$VM_BASE_PATH/video-call-integration/"
scp "$LOCAL_BASE_PATH/README.md" "$VM_USER@$VM_HOST:$VM_BASE_PATH/video-call-integration/"
scp "$LOCAL_BASE_PATH/INTEGRATION-README.md" "$VM_USER@$VM_HOST:$VM_BASE_PATH/video-call-integration/"

if [ $? -ne 0 ]; then
    print_error "Failed to copy configuration files"
    exit 1
fi
print_success "Configuration files copied"

# Set permissions
print_status "Setting permissions..."
ssh "$VM_USER@$VM_HOST" << EOF
chmod +x $VM_BASE_PATH/video-call-integration/deployment/*.sh
chmod +x $VM_BASE_PATH/video-call-integration/deployment/*.ps1
find $VM_BASE_PATH/video-call-integration -type f -name "*.js" -exec chmod 644 {} \;
find $VM_BASE_PATH/video-call-integration -type f -name "*.json" -exec chmod 644 {} \;
EOF

if [ $? -ne 0 ]; then
    print_error "Failed to set permissions"
    exit 1
fi
print_success "Permissions set"

# Verify file structure
print_status "Verifying file structure on VM..."
echo "Remote file structure (first 20 files):"
ssh "$VM_USER@$VM_HOST" "find $VM_BASE_PATH/video-call-integration -type f | head -20"

echo ""
echo -e "${GREEN}🎉 All files copied successfully!${NC}"
echo ""
echo -e "📂 Files are located at: $VM_BASE_PATH/video-call-integration/"
echo ""
echo -e "📋 Next Steps:"
echo -e "   1. SSH to VM: ssh $VM_USER@$VM_HOST"
echo -e "   2. Navigate to: cd $VM_BASE_PATH/video-call-integration"
echo -e "   3. Run deployment: ./deployment/deploy-server.sh"
echo -e "   4. Or use PowerShell: pwsh ./deployment/deploy-server.ps1"
echo ""
echo -e "🔍 Quick verification commands:"
echo -e "   Check files: ssh $VM_USER@$VM_HOST 'ls -la $VM_BASE_PATH/video-call-integration/'"
echo -e "   Check server: ssh $VM_USER@$VM_HOST 'ls -la $VM_BASE_PATH/video-call-integration/server/'"
echo -e "   Check database: ssh $VM_USER@$VM_HOST 'ls -la $VM_BASE_PATH/video-call-integration/database/'"

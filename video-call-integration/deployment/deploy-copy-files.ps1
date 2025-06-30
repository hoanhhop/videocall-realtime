# Video Call Integration - Copy Files Script
# Copy các file cần thiết lên VM với SSH user hopboy553

param(
    [string]$VMHost = "34.126.167.181",
    [string]$VMUser = "hopboy553",
    [string]$VMBasePath = "/home/hopboy553/video-call-translation_OFFICIAL",
    [string]$LocalBasePath = "."
)

# Colors for output
function Write-Status($message) {
    Write-Host "📋 $message" -ForegroundColor Yellow
}

function Write-Success($message) {
    Write-Host "✅ $message" -ForegroundColor Green
}

function Write-ErrorMsg($message) {
    Write-Host "❌ $message" -ForegroundColor Red
}

Write-Host "🚀 Video Call Integration - File Copy Script" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green

# Test SSH connection
Write-Status "Testing SSH connection..."
$connectionTest = ssh -o ConnectTimeout=10 "$VMUser@$VMHost" "echo 'Connected successfully'" 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-ErrorMsg "Cannot connect to VM: $VMHost with user: $VMUser"
    Write-Host "Please check:"
    Write-Host "1. SSH key is properly configured"
    Write-Host "2. VM is accessible: ssh $VMUser@$VMHost"
    exit 1
}
Write-Success "SSH connection established"

# Create directories on VM
Write-Status "Creating directory structure on VM..."
ssh "$VMUser@$VMHost" @"
mkdir -p $VMBasePath/video-call-integration/server
mkdir -p $VMBasePath/video-call-integration/database
mkdir -p $VMBasePath/video-call-integration/client-components
mkdir -p $VMBasePath/video-call-integration/deployment
mkdir -p $VMBasePath/video-call-integration/nginx
mkdir -p $VMBasePath/video-call-integration/logs
"@

if ($LASTEXITCODE -ne 0) {
    Write-ErrorMsg "Failed to create directories"
    exit 1
}
Write-Success "Directory structure created"

# Copy server files
Write-Status "Copying server files..."
scp -r "$LocalBasePath/server/*" "$VMUser@$VMHost`:$VMBasePath/video-call-integration/server/"
if ($LASTEXITCODE -ne 0) {
    Write-ErrorMsg "Failed to copy server files"
    exit 1
}
Write-Success "Server files copied"

# Copy database files
Write-Status "Copying database files..."
scp -r "$LocalBasePath/database/*" "$VMUser@$VMHost`:$VMBasePath/video-call-integration/database/"
if ($LASTEXITCODE -ne 0) {
    Write-ErrorMsg "Failed to copy database files"
    exit 1
}
Write-Success "Database files copied"

# Copy client components
Write-Status "Copying client components..."
scp -r "$LocalBasePath/client-components/*" "$VMUser@$VMHost`:$VMBasePath/video-call-integration/client-components/"
if ($LASTEXITCODE -ne 0) {
    Write-ErrorMsg "Failed to copy client components"
    exit 1
}
Write-Success "Client components copied"

# Copy deployment scripts
Write-Status "Copying deployment scripts..."
scp -r "$LocalBasePath/deployment/*" "$VMUser@$VMHost`:$VMBasePath/video-call-integration/deployment/"
if ($LASTEXITCODE -ne 0) {
    Write-ErrorMsg "Failed to copy deployment scripts"
    exit 1
}
Write-Success "Deployment scripts copied"

# Copy nginx configuration
Write-Status "Copying nginx configuration..."
scp -r "$LocalBasePath/nginx/*" "$VMUser@$VMHost`:$VMBasePath/video-call-integration/nginx/"
if ($LASTEXITCODE -ne 0) {
    Write-ErrorMsg "Failed to copy nginx configuration"
    exit 1
}
Write-Success "Nginx configuration copied"

# Copy Docker Compose and README files
Write-Status "Copying configuration files..."
scp "$LocalBasePath/docker-compose.integration.yml" "$VMUser@$VMHost`:$VMBasePath/video-call-integration/"
scp "$LocalBasePath/README.md" "$VMUser@$VMHost`:$VMBasePath/video-call-integration/"
scp "$LocalBasePath/INTEGRATION-README.md" "$VMUser@$VMHost`:$VMBasePath/video-call-integration/"

if ($LASTEXITCODE -ne 0) {
    Write-ErrorMsg "Failed to copy configuration files"
    exit 1
}
Write-Success "Configuration files copied"

# Set permissions
Write-Status "Setting permissions..."
ssh "$VMUser@$VMHost" @"
chmod +x $VMBasePath/video-call-integration/deployment/*.sh
chmod +x $VMBasePath/video-call-integration/deployment/*.ps1
find $VMBasePath/video-call-integration -type f -name "*.js" -exec chmod 644 {} \;
find $VMBasePath/video-call-integration -type f -name "*.json" -exec chmod 644 {} \;
"@

if ($LASTEXITCODE -ne 0) {
    Write-ErrorMsg "Failed to set permissions"
    exit 1
}
Write-Success "Permissions set"

# Verify file structure
Write-Status "Verifying file structure on VM..."
$remoteStructure = ssh "$VMUser@$VMHost" "find $VMBasePath/video-call-integration -type f | head -20"
Write-Host "Remote file structure (first 20 files):"
Write-Host $remoteStructure -ForegroundColor Cyan

Write-Host ""
Write-Host "🎉 All files copied successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📂 Files are located at: $VMBasePath/video-call-integration/"
Write-Host ""
Write-Host "📋 Next Steps:"
Write-Host "   1. SSH to VM: ssh $VMUser@$VMHost"
Write-Host "   2. Navigate to: cd $VMBasePath/video-call-integration"
Write-Host "   3. Run deployment: ./deployment/deploy-server.sh"
Write-Host "   4. Or use PowerShell: pwsh ./deployment/deploy-server.ps1"
Write-Host ""
Write-Host "🔍 Quick verification commands:"
Write-Host "   Check files: ssh $VMUser@$VMHost 'ls -la $VMBasePath/video-call-integration/'"
Write-Host "   Check server: ssh $VMUser@$VMHost 'ls -la $VMBasePath/video-call-integration/server/'"
Write-Host "   Check database: ssh $VMUser@$VMHost 'ls -la $VMBasePath/video-call-integration/database/'"

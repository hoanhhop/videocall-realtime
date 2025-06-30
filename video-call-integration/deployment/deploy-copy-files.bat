@echo off
REM Video Call Integration - File Copy Script (Windows)
REM Copy all necessary files to VM for deployment

set VM_HOST=34.142.175.163
set VM_USER=hopboy553
set VM_BASE_PATH=/home/hopboy553/video-call-translation_OFFICIAL
set LOCAL_BASE_PATH=..

echo 🚀 Video Call Integration - File Copy Script
echo ============================================

echo 📋 Testing SSH connection...
ssh -o ConnectTimeout=10 %VM_USER%@%VM_HOST% "echo Connected successfully" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo ❌ Cannot connect to VM: %VM_HOST% with user: %VM_USER%
    echo Please check:
    echo 1. SSH key is properly configured
    echo 2. VM is accessible: ssh %VM_USER%@%VM_HOST%
    exit /b 1
)
echo ✅ SSH connection established

echo 📋 Creating directory structure on VM...
ssh %VM_USER%@%VM_HOST% "mkdir -p %VM_BASE_PATH%/video-call-integration/server"
ssh %VM_USER%@%VM_HOST% "mkdir -p %VM_BASE_PATH%/video-call-integration/database"
ssh %VM_USER%@%VM_HOST% "mkdir -p %VM_BASE_PATH%/video-call-integration/client-components"
ssh %VM_USER%@%VM_HOST% "mkdir -p %VM_BASE_PATH%/video-call-integration/deployment"
ssh %VM_USER%@%VM_HOST% "mkdir -p %VM_BASE_PATH%/video-call-integration/nginx"
ssh %VM_USER%@%VM_HOST% "mkdir -p %VM_BASE_PATH%/video-call-integration/logs"
echo ✅ Directory structure created

echo 📋 Copying server files...
scp -r "%LOCAL_BASE_PATH%/server/*" "%VM_USER%@%VM_HOST%:%VM_BASE_PATH%/video-call-integration/server/"
if %ERRORLEVEL% neq 0 (
    echo ❌ Failed to copy server files
    exit /b 1
)
echo ✅ Server files copied

echo 📋 Copying database files...
scp -r "%LOCAL_BASE_PATH%/database/*" "%VM_USER%@%VM_HOST%:%VM_BASE_PATH%/video-call-integration/database/"
if %ERRORLEVEL% neq 0 (
    echo ❌ Failed to copy database files
    exit /b 1
)
echo ✅ Database files copied

echo 📋 Copying client components...
scp -r "%LOCAL_BASE_PATH%/client-components/*" "%VM_USER%@%VM_HOST%:%VM_BASE_PATH%/video-call-integration/client-components/"
if %ERRORLEVEL% neq 0 (
    echo ❌ Failed to copy client components
    exit /b 1
)
echo ✅ Client components copied

echo 📋 Copying deployment scripts...
scp -r "%LOCAL_BASE_PATH%/deployment/*" "%VM_USER%@%VM_HOST%:%VM_BASE_PATH%/video-call-integration/deployment/"
if %ERRORLEVEL% neq 0 (
    echo ❌ Failed to copy deployment scripts
    exit /b 1
)
echo ✅ Deployment scripts copied

echo 📋 Copying nginx configuration...
scp -r "%LOCAL_BASE_PATH%/nginx/*" "%VM_USER%@%VM_HOST%:%VM_BASE_PATH%/video-call-integration/nginx/"
if %ERRORLEVEL% neq 0 (
    echo ❌ Failed to copy nginx configuration
    exit /b 1
)
echo ✅ Nginx configuration copied

echo 📋 Copying configuration files...
scp "%LOCAL_BASE_PATH%/docker-compose.integration.yml" "%VM_USER%@%VM_HOST%:%VM_BASE_PATH%/video-call-integration/"
scp "%LOCAL_BASE_PATH%/README.md" "%VM_USER%@%VM_HOST%:%VM_BASE_PATH%/video-call-integration/" 2>nul
scp "%LOCAL_BASE_PATH%/INTEGRATION-README.md" "%VM_USER%@%VM_HOST%:%VM_BASE_PATH%/video-call-integration/" 2>nul
echo ✅ Configuration files copied

echo 📋 Setting permissions...
ssh %VM_USER%@%VM_HOST% "chmod +x %VM_BASE_PATH%/video-call-integration/deployment/*.sh"
ssh %VM_USER%@%VM_HOST% "find %VM_BASE_PATH%/video-call-integration -type f -name '*.js' -exec chmod 644 {} \;"
ssh %VM_USER%@%VM_HOST% "find %VM_BASE_PATH%/video-call-integration -type f -name '*.json' -exec chmod 644 {} \;"
echo ✅ Permissions set

echo 📋 Verifying file structure on VM...
ssh %VM_USER%@%VM_HOST% "find %VM_BASE_PATH%/video-call-integration -type f | head -20"

echo.
echo 🎉 All files copied successfully!
echo.
echo 📂 Files are located at: %VM_BASE_PATH%/video-call-integration/
echo.
echo 📋 Next Steps:
echo    1. SSH to VM: ssh %VM_USER%@%VM_HOST%
echo    2. Navigate to: cd %VM_BASE_PATH%/video-call-integration
echo    3. Run deployment: ./deployment/deploy-server.sh
echo.
echo 🔍 Quick verification commands:
echo    Check files: ssh %VM_USER%@%VM_HOST% 'ls -la %VM_BASE_PATH%/video-call-integration/'
echo    Check server: ssh %VM_USER%@%VM_HOST% 'ls -la %VM_BASE_PATH%/video-call-integration/server/'

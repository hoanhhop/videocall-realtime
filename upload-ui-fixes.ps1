# Script to upload UI fixes to production server
param(
    [string]$ServerIP = "34.142.175.163",
    [string]$Username = "hopboy553"
)

Write-Host "Uploading UI fixes to production server..." -ForegroundColor Green

# Define source and destination paths
$localBasePath = "e:\video-call-translation_OFFICIAL"
$remoteBasePath = "video-call-translation_OFFICIAL"

# Files to upload
$filesToUpload = @(
    @{
        Local = "$localBasePath\client\src\components\VideoCall\RoomInfo.jsx"
        Remote = "$remoteBasePath/client/src/components/VideoCall/RoomInfo.jsx"
    },
    @{
        Local = "$localBasePath\client\src\components\VideoCall\RoomInfo.css"
        Remote = "$remoteBasePath/client/src/components/VideoCall/RoomInfo.css"
    },
    @{
        Local = "$localBasePath\client\src\components\VideoCall\VideoCall.jsx"
        Remote = "$remoteBasePath/client/src/components/VideoCall/VideoCall.jsx"
    },
    @{
        Local = "$localBasePath\client\src\components\VideoCall\RoomInput.css"
        Remote = "$remoteBasePath/client/src/components/VideoCall/RoomInput.css"
    }
)

# Upload each file
foreach ($file in $filesToUpload) {
    Write-Host "Uploading: $($file.Local)" -ForegroundColor Yellow
    
    # Check if local file exists
    if (Test-Path $file.Local) {
        # Create remote directory if needed
        $remoteDir = Split-Path $file.Remote -Parent
        ssh "$Username@$ServerIP" "mkdir -p $remoteDir"
        
        # Upload file
        scp "$($file.Local)" "$Username@$ServerIP`:$($file.Remote)"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Successfully uploaded: $($file.Remote)" -ForegroundColor Green
        } else {
            Write-Host "✗ Failed to upload: $($file.Remote)" -ForegroundColor Red
        }
    } else {
        Write-Host "✗ Local file not found: $($file.Local)" -ForegroundColor Red
    }
}

Write-Host "`nAll UI fixes uploaded!" -ForegroundColor Green
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Rebuild and restart containers:" -ForegroundColor White
Write-Host "   ssh $Username@$ServerIP `"cd $remoteBasePath && docker-compose -f docker-compose.production.yml up --build -d`"" -ForegroundColor Cyan
Write-Host "2. Check application at: https://$ServerIP/" -ForegroundColor White

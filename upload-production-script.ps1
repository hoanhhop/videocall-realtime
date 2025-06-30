#!/usr/bin/env powershell
# Upload production deploy script to VM

$VMHost = "34.126.167.181"
$VMUser = "hopboy553"
$RemotePath = "/home/hopboy553/video-call-translation_OFFICIAL"

Write-Host "=== Uploading production deploy script to VM ===" -ForegroundColor Green

# Upload the production deploy script
Write-Host "Uploading vm-production-deploy.sh..." -ForegroundColor Yellow
scp "vm-production-deploy.sh" "${VMUser}@${VMHost}:${RemotePath}/"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Upload successful!" -ForegroundColor Green
    
    # Make script executable
    Write-Host "Making script executable..." -ForegroundColor Yellow
    ssh "${VMUser}@${VMHost}" "chmod +x ${RemotePath}/vm-production-deploy.sh"
    
    Write-Host "=== Ready to deploy ===" -ForegroundColor Green
    Write-Host "Now SSH to VM and run the script:" -ForegroundColor Cyan
    Write-Host "ssh hopboy553@34.126.167.181" -ForegroundColor White
    Write-Host "cd video-call-translation_OFFICIAL" -ForegroundColor White
    Write-Host "./vm-production-deploy.sh" -ForegroundColor White
    
} else {
    Write-Host "Upload failed!" -ForegroundColor Red
    Write-Host "Please check SSH connection and try again." -ForegroundColor Yellow
}

Write-Host "`nAlternatively, you can copy the script content manually:" -ForegroundColor Cyan
Write-Host "1. SSH to VM: ssh hopboy553@34.126.167.181" -ForegroundColor White
Write-Host "2. Create script: nano vm-production-deploy.sh" -ForegroundColor White
Write-Host "3. Copy content from vm-production-deploy.sh file" -ForegroundColor White
Write-Host "4. Make executable: chmod +x vm-production-deploy.sh" -ForegroundColor White
Write-Host "5. Run: ./vm-production-deploy.sh" -ForegroundColor White

#!/usr/bin/env powershell
# Upload essential files to VM

$VMHost = "34.142.175.163"
$VMUser = "hopbo"
$RemotePath = "/home/hopbo/video-call-translation"
$SSHKey = "$env:USERPROFILE\.ssh\id_ed25519_vm_nopw"

Write-Host "=== Uploading files to VM ===" -ForegroundColor Green

# Upload docker-compose.production.yml
Write-Host "Uploading docker-compose.production.yml..." -ForegroundColor Cyan
scp -i $SSHKey "docker-compose.production.yml" "${VMUser}@${VMHost}:${RemotePath}/"

# Upload Dockerfiles
Write-Host "Uploading Dockerfiles..." -ForegroundColor Cyan
scp -i $SSHKey "server/Dockerfile.api" "${VMUser}@${VMHost}:${RemotePath}/server/"
scp -i $SSHKey "server/Dockerfile.socket" "${VMUser}@${VMHost}:${RemotePath}/server/"

# Upload updated server files
Write-Host "Uploading server files..." -ForegroundColor Cyan
scp -i $SSHKey "server/api/server.js" "${VMUser}@${VMHost}:${RemotePath}/server/api/"

# Upload deploy commands
Write-Host "Uploading deploy commands..." -ForegroundColor Cyan
scp -i $SSHKey "vm-deploy-commands.sh" "${VMUser}@${VMHost}:${RemotePath}/"

Write-Host "Files uploaded successfully!" -ForegroundColor Green
Write-Host "Now SSH to VM and run the commands:" -ForegroundColor Yellow
Write-Host "ssh -i $SSHKey ${VMUser}@${VMHost}" -ForegroundColor White
Write-Host "cd ${RemotePath}" -ForegroundColor White
Write-Host "chmod +x vm-deploy-commands.sh" -ForegroundColor White
Write-Host "./vm-deploy-commands.sh" -ForegroundColor White

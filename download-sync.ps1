#!/usr/bin/env powershell
# Download and Sync Script from VM to Local

param(
    [string]$VMHost = "34.126.167.181",
    [string]$VMUser = "hopboy553",
    [string]$RemotePath = "/home/hopboy553/video-call-translation_OFFICIAL"
)

Write-Host "=== Download and Sync from VM to Local ===" -ForegroundColor Green

# Tạo thư mục backup local nếu chưa có
$backupDir = ".\backup_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
if (!(Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force
    Write-Host "Created backup directory: $backupDir" -ForegroundColor Yellow
}

# Backup current local files
Write-Host "Backing up current local files..." -ForegroundColor Yellow
if (Test-Path ".\server\services") {
    Copy-Item -Path ".\server\services" -Destination "$backupDir\services_local_backup" -Recurse -Force
    Write-Host "Local services backed up to $backupDir" -ForegroundColor Green
}

# Download files from VM
Write-Host "Downloading files from VM..." -ForegroundColor Cyan

$filesToDownload = @(
    "server/services/",
    "server/package.json",
    "docker-compose.production.yml"
)

foreach ($item in $filesToDownload) {
    Write-Host "Downloading $item..." -ForegroundColor Cyan
    
    $localDir = Split-Path "$item" -Parent
    if ($localDir -and !(Test-Path $localDir)) {
        New-Item -ItemType Directory -Path $localDir -Force
    }
    
    # Download using scp
    if ($item.EndsWith("/")) {
        # Directory download
        scp -r "${VMUser}@${VMHost}:$RemotePath/$item" "./$item"
    } else {
        # File download
        scp "${VMUser}@${VMHost}:$RemotePath/$item" "./$item"
    }
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Successfully downloaded $item" -ForegroundColor Green
    } else {
        Write-Host "Error downloading $item" -ForegroundColor Red
    }
}

Write-Host "Sync completed. Check downloaded files before proceeding." -ForegroundColor Green
Write-Host "Backup location: $backupDir" -ForegroundColor Yellow

#!/bin/bash
# Download and Sync Script from VM to Local

VM_HOST="34.126.167.181"
VM_USER="hopboy553"
REMOTE_PATH="/home/hopboy553/video-call-translation_OFFICIAL"

echo "=== Download and Sync from VM to Local ==="

# Tạo thư mục backup local nếu chưa có
BACKUP_DIR="./backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"
echo "Created backup directory: $BACKUP_DIR"

# Backup current local files
echo "Backing up current local files..."
if [ -d "./server/services" ]; then
    cp -r "./server/services" "$BACKUP_DIR/services_local_backup"
    echo "Local services backed up to $BACKUP_DIR"
fi

# Download files from VM
echo "Downloading files from VM..."

# Download services directory
echo "Downloading server/services/..."
scp -r "${VM_USER}@${VM_HOST}:${REMOTE_PATH}/server/services/" "./server/"

if [ $? -eq 0 ]; then
    echo "Successfully downloaded server/services/"
else
    echo "Error downloading server/services/"
fi

# Download package.json
echo "Downloading server/package.json..."
scp "${VM_USER}@${VM_HOST}:${REMOTE_PATH}/server/package.json" "./server/package.json"

if [ $? -eq 0 ]; then
    echo "Successfully downloaded server/package.json"
else
    echo "Error downloading server/package.json"
fi

# Download docker-compose.production.yml
echo "Downloading docker-compose.production.yml..."
scp "${VM_USER}@${VM_HOST}:${REMOTE_PATH}/docker-compose.production.yml" "./docker-compose.production.yml"

if [ $? -eq 0 ]; then
    echo "Successfully downloaded docker-compose.production.yml"
else
    echo "Error downloading docker-compose.production.yml"
fi

echo "Sync completed. Check downloaded files before proceeding."
echo "Backup location: $BACKUP_DIR"

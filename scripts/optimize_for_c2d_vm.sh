#!/bin/bash
# Comprehensive script to optimize resource allocation and configuration 
# for video-call-translation pipeline on c2d-standard-8 VM (8 vCPUs, 32 GB Memory)

# Set script to exit on error
set -e

# Terminal colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}===================================================${NC}"
echo -e "${BLUE}   Optimizing Video Call Translation for c2d-standard-8 VM   ${NC}"
echo -e "${BLUE}   (8 vCPUs, 32 GB Memory)                                  ${NC}"
echo -e "${BLUE}===================================================${NC}"

# Find project root directory
PROJECT_ROOT=$(cd "$(dirname "$0")" && pwd)

# Function to check if a command exists
command_exists() {
    command -v "$1" &> /dev/null
}

# Check for required tools
echo -e "${YELLOW}Checking for required tools...${NC}"

if ! command_exists python3; then
    echo -e "${RED}Python 3 is required but not installed.${NC}"
    exit 1
fi

if ! command_exists pip3; then
    echo -e "${RED}pip3 is required but not installed.${NC}"
    exit 1
fi

if ! command_exists docker; then
    echo -e "${RED}Docker is required but not installed.${NC}"
    echo -e "${YELLOW}Please run optimize_vm.sh first to set up the environment.${NC}"
    exit 1
fi

if ! command_exists docker-compose; then
    echo -e "${RED}Docker Compose is required but not installed.${NC}"
    echo -e "${YELLOW}Please run optimize_vm.sh first to set up the environment.${NC}"
    exit 1
fi

# Create the optimized environment configuration
echo -e "${YELLOW}Creating optimized environment configuration...${NC}"
cat > "$PROJECT_ROOT/server/.env.optimized" << 'EOF'
# Optimized configuration for c2d-standard-8 VM (8 vCPUs, 32 GB Memory)

# General settings
NODE_ENV=production
CORS_ORIGIN=*

# Redis
REDIS_URL=redis://redis:6379

# Service URLs
PHOWHISPER_ASR_URL=http://phowhisper:50051
TRANSLATION_SERVICE_URL=http://translation:50052
TTS_SERVICE_URL=http://tts:5002
EMBEDDING_SERVICE_URL=http://embeddings:5003

# PhoWhisper ASR Service (ASR needs significant resources)
MODEL_PATH_CT2=/app/models/phowhisper/PhoWhisper-medium-ct2
PORT_ASR=50051
OMP_NUM_THREADS=4
USE_CUDA=true
BEAM_SIZE=1                          # Use greedy decoding for speed
GPU_DEVICE=0
COMPUTE_TYPE=float16                 # Use FP16 for faster inference
CHUNK_LENGTH=0.4                     # Optimized chunk length
VAD_FILTER=true                      # Voice Activity Detection to improve performance
LOW_MEMORY=true                      # Reduce memory usage
MAX_WORKERS=2                        # Limited workers for better resource sharing
PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512

# Translation Service (OPUS-MT with CT2 optimization)
OPUS_MODELS_BASE_PATH=/app/models/opus_mt
PORT_TRANSLATION=50052
USE_CUDA=true
MAX_LENGTH=512
BATCH_SIZE=16                        # Increased batch size for better throughput
GPU_DEVICE=0
OMP_NUM_THREADS=4
NUM_WORKERS=4                        # Adjusted for 8 vCPU system
CPU_THREADS=8                        # Maximize CPU usage for non-GPU operations
MAX_QUEUE_SIZE=32                    # Optimized queue size

# TTS Service
MODEL_PATH=/app/models/XTTS-v2
ONNX_MODEL_PATH=/app/models/XTTS-v2/onnx
PORT=5002
USE_CUDA=true
USE_ONNX=true                        # Use ONNX acceleration
BATCH_SIZE=2                         # Balanced batch size
SPEAKER_WAV_PATH=/app/models/speakers
SAMPLE_RATE=24000                    # High-quality audio
GPU_DEVICE=0
PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
OMP_NUM_THREADS=4
CHUNK_SIZE=150                       # Optimized chunk size
MAX_WORKERS=2                        # Limited workers for balanced load
LOW_MEMORY=true                      # Reduce memory usage

# Embeddings Service
EMBEDDING_MODEL=all-MiniLM-L6-v2     # Efficient embedding model
PORT=5003
ENABLE_CACHE=true
CACHE_DIR=/app/data
USE_CUDA=true
BATCH_SIZE=32                        # Higher batch size for embeddings
GPU_DEVICE=0

# Node.js Settings
NODE_OPTIONS=--max-old-space-size=2048
EOF

echo -e "${GREEN}Created optimized environment configuration at server/.env.optimized${NC}"

# Create a modified docker-compose file with resource constraints
echo -e "${YELLOW}Creating optimized Docker Compose configuration...${NC}"
cat > "$PROJECT_ROOT/docker-compose.optimized.yml" << 'EOF'
# Optimized docker-compose override file for video-call-translation on c2d-standard-8 VM
version: '3.8'

services:
  traefik:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M

  api:
    environment:
      - NODE_OPTIONS=--max-old-space-size=2048
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G

  socket:
    environment:
      - NODE_OPTIONS=--max-old-space-size=2048
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 2G

  phowhisper:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 8G
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]

  translation:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 8G
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]

  tts:
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 8G
      reservations:
        devices:
          - driver: nvidia
            count: 1
            capabilities: [gpu]

  embeddings:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 1G

  client:
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M

  redis:
    command: redis-server --save 60 1 --loglevel warning --maxmemory 512mb --maxmemory-policy allkeys-lru
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
EOF

echo -e "${GREEN}Created optimized Docker Compose configuration at docker-compose.optimized.yml${NC}"

# Create an optimized start script for the pipeline
echo -e "${YELLOW}Creating optimized start script...${NC}"
cat > "$PROJECT_ROOT/start_optimized.bat" << 'EOF'
@echo off
echo ===================================================
echo Starting Video Call Translation System (Optimized)
echo ===================================================

REM Copy optimized environment file
copy /Y server\.env.optimized server\.env
if %ERRORLEVEL% neq 0 (
    echo Error: Failed to copy optimized environment configuration.
    exit /b %ERRORLEVEL%
)
echo Applied optimized environment configuration.

REM Start Docker containers with optimized configuration
docker-compose -f docker-compose.yml -f docker-compose.optimized.yml up -d
if %ERRORLEVEL% neq 0 (
    echo Error: Failed to start Docker containers.
    exit /b %ERRORLEVEL%
)

echo.
echo System started successfully!
echo.
echo Access the web interface at: http://localhost:8081
echo View Traefik dashboard at: http://localhost:8082
echo.
echo To check the status of services, run: docker ps
echo To view logs, run: docker-compose logs -f [service_name]
echo.
EOF

chmod +x "$PROJECT_ROOT/start_optimized.bat"
echo -e "${GREEN}Created optimized start script at start_optimized.bat${NC}"

# Create script to check OPUS-MT models and convert them if needed
echo -e "${YELLOW}Creating OPUS-MT model check and conversion script...${NC}"
cat > "$PROJECT_ROOT/scripts/check_and_convert_models.py" << 'EOF'
#!/usr/bin/env python3
# Script to check for OPUS-MT models and convert them to CT2 format if needed

import os
import sys
import logging
import subprocess
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('model_conversion.log')
    ]
)
logger = logging.getLogger(__name__)

def find_project_root():
    """Find the project root directory"""
    current_path = os.path.dirname(os.path.abspath(__file__))
    parent_path = os.path.dirname(current_path)
    if os.path.exists(os.path.join(parent_path, "server")):
        return parent_path
    return os.path.abspath(os.path.join(parent_path, ".."))

def check_and_download_opus_mt(model_name, model_dir):
    """Check if OPUS-MT model exists, download if needed"""
    if os.path.exists(model_dir) and any(os.listdir(model_dir)):
        logger.info(f"Model {model_name} already exists at {model_dir}")
        return True
    
    try:
        logger.info(f"Downloading {model_name} from Hugging Face...")
        
        # Create directory if it doesn't exist
        os.makedirs(model_dir, exist_ok=True)
        
        # Use Python to download the model
        import torch
        from transformers import MarianMTModel, MarianTokenizer
        
        tokenizer = MarianTokenizer.from_pretrained(f"Helsinki-NLP/{model_name}")
        model = MarianMTModel.from_pretrained(f"Helsinki-NLP/{model_name}")
        
        # Save model and tokenizer locally
        tokenizer.save_pretrained(model_dir)
        model.save_pretrained(model_dir)
        
        logger.info(f"Successfully downloaded {model_name}")
        return True
    except Exception as e:
        logger.error(f"Failed to download {model_name}: {e}")
        return False

def convert_to_ct2(model_path, output_path):
    """Convert OPUS-MT model to CT2 format"""
    if os.path.exists(output_path) and any(os.listdir(output_path)):
        logger.info(f"CT2 model already exists at {output_path}")
        return True
    
    try:
        logger.info(f"Converting model at {model_path} to CT2 format...")
        
        # Find convert_opus_to_ct2.py script
        project_root = find_project_root()
        converter_script = os.path.join(project_root, "convert_opus_to_ct2.py")
        
        if not os.path.exists(converter_script):
            logger.error(f"Converter script not found at {converter_script}")
            return False
        
        # Run the conversion script
        cmd = [
            sys.executable, 
            converter_script, 
            "--model_path", model_path,
            "--output_path", output_path,
            "--quantization", "float16",
            "--device", "cuda" if torch.cuda.is_available() else "cpu"
        ]
        
        result = subprocess.run(cmd, check=True, capture_output=True, text=True)
        logger.info(f"Conversion output: {result.stdout}")
        
        if result.returncode != 0:
            logger.error(f"Conversion failed with error: {result.stderr}")
            return False
            
        logger.info(f"Successfully converted to CT2 at {output_path}")
        return True
    except Exception as e:
        logger.error(f"Failed to convert to CT2: {e}")
        return False

def check_xtts_onnx(model_dir, onnx_dir):
    """Check if XTTS ONNX model exists, create placeholder if needed"""
    if os.path.exists(onnx_dir) and any(os.listdir(onnx_dir)):
        logger.info(f"XTTS ONNX model already exists at {onnx_dir}")
        return True
    
    try:
        logger.info(f"Setting up XTTS ONNX directory at {onnx_dir}...")
        
        # Create directory if it doesn't exist
        os.makedirs(onnx_dir, exist_ok=True)
        
        # Create placeholder README file
        with open(os.path.join(onnx_dir, "README.txt"), "w") as f:
            f.write("XTTS-v2 ONNX optimization directory.\n")
            f.write("Full ONNX conversion will be handled at runtime by the TTS service.\n")
        
        # Create marker.json to indicate optimization attempt
        import json
        import datetime
        with open(os.path.join(onnx_dir, "marker.json"), "w") as f:
            json.dump({
                "attempted": True,
                "date": datetime.datetime.now().isoformat(),
                "model": "XTTS-v2"
            }, f)
        
        logger.info(f"Successfully created XTTS ONNX placeholder")
        return True
    except Exception as e:
        logger.error(f"Failed to create XTTS ONNX placeholder: {e}")
        return False

def main():
    project_root = find_project_root()
    models_dir = os.path.join(project_root, "server", "models")
    
    # Ensure models directory exists
    os.makedirs(models_dir, exist_ok=True)
    
    # Define OPUS-MT models to check and convert
    opus_mt_dir = os.path.join(models_dir, "opus_mt")
    os.makedirs(opus_mt_dir, exist_ok=True)
    
    opus_models = {
        "opus-mt-en-vi": os.path.join(opus_mt_dir, "opus-mt-en-vi"),
        "opus-mt-vi-en": os.path.join(opus_mt_dir, "opus-mt-vi-en")
    }
    
    # Check and download OPUS-MT models
    for model_name, model_dir in opus_models.items():
        if check_and_download_opus_mt(model_name, model_dir):
            # Convert to CT2
            ct2_dir = f"{model_dir}-ct2"
            convert_to_ct2(model_dir, ct2_dir)
    
    # Check XTTS ONNX
    tts_dir = os.path.join(models_dir, "tts", "XTTS-v2")
    onnx_dir = os.path.join(tts_dir, "onnx")
    
    os.makedirs(os.path.join(models_dir, "tts"), exist_ok=True)
    os.makedirs(tts_dir, exist_ok=True)
    
    check_xtts_onnx(tts_dir, onnx_dir)
    
    logger.info("Model check and conversion completed")

if __name__ == "__main__":
    main()
EOF

chmod +x "$PROJECT_ROOT/scripts/check_and_convert_models.py"
echo -e "${GREEN}Created model check and conversion script at scripts/check_and_convert_models.py${NC}"

# Create a monitoring script
echo -e "${YELLOW}Creating monitoring script...${NC}"
cat > "$PROJECT_ROOT/scripts/monitor_services.bat" << 'EOF'
@echo off
setlocal

echo ===================================================
echo Video Call Translation - Service Monitoring Tool
echo ===================================================

:menu
echo.
echo Choose an option:
echo 1. Show status of all services
echo 2. View logs for a specific service
echo 3. Restart a specific service
echo 4. Check resource usage
echo 5. Clean Docker cache
echo 6. Exit
echo.

set /p choice=Enter choice [1-6]: 

if "%choice%"=="1" goto :status
if "%choice%"=="2" goto :logs
if "%choice%"=="3" goto :restart
if "%choice%"=="4" goto :resources
if "%choice%"=="5" goto :clean
if "%choice%"=="6" goto :exit

echo Invalid choice. Please try again.
goto :menu

:status
echo.
echo === Service Status ===
docker-compose ps
echo.
pause
goto :menu

:logs
echo.
echo Available services:
echo - traefik
echo - api
echo - socket
echo - phowhisper
echo - translation
echo - tts
echo - embeddings
echo - client
echo - redis
echo.
set /p service=Enter service name: 
set /p lines=How many lines to show [50]: 

if "%lines%"=="" set lines=50

echo.
echo === Logs for %service% (last %lines% lines) ===
docker-compose logs --tail=%lines% %service%
echo.
pause
goto :menu

:restart
echo.
echo Available services:
echo - traefik
echo - api
echo - socket
echo - phowhisper
echo - translation
echo - tts
echo - embeddings
echo - client
echo - redis
echo.
set /p service=Enter service name to restart: 

echo.
echo Restarting %service%...
docker-compose restart %service%
echo %service% restarted.
echo.
pause
goto :menu

:resources
echo.
echo === Resource Usage ===
docker stats --no-stream
echo.
pause
goto :menu

:clean
echo.
echo Cleaning Docker cache...
docker system prune -f
echo Docker cache cleaned.
echo.
pause
goto :menu

:exit
echo.
echo Exiting monitoring tool.
exit /b 0
EOF

chmod +x "$PROJECT_ROOT/scripts/monitor_services.bat"
echo -e "${GREEN}Created monitoring script at scripts/monitor_services.bat${NC}"

# Summary and instructions
echo -e "${BLUE}===================================================${NC}"
echo -e "${GREEN}Optimization completed successfully!${NC}"
echo -e "${BLUE}===================================================${NC}"
echo -e "${YELLOW}To apply these optimizations:${NC}"
echo -e ""
echo -e "${YELLOW}1. Convert models to optimized formats:${NC}"
echo -e "   python scripts/check_and_convert_models.py"
echo -e ""
echo -e "${YELLOW}2. Start the system with optimized settings:${NC}"
echo -e "   start_optimized.bat"
echo -e ""
echo -e "${YELLOW}3. Monitor the system:${NC}"
echo -e "   scripts/monitor_services.bat"
echo -e ""
echo -e "${BLUE}===================================================${NC}"

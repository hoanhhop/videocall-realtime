#!/bin/bash
# Script to convert OPUS-MT models to CT2 format and optimize the TTS model to ONNX
# This script should be run before deploying the application

set -e  # Exit on error

echo "======================================================="
echo "Video Call Translation System - Optimization Script"
echo "======================================================="

# Define project root and directories
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MODELS_DIR="$PROJECT_ROOT/server/models"
OPUS_MT_DIR="$MODELS_DIR/opus_mt"
TTS_DIR="$MODELS_DIR/tts"

# Create directories if they don't exist
mkdir -p "$OPUS_MT_DIR"
mkdir -p "$TTS_DIR"
mkdir -p "$TTS_DIR/XTTS-v2/onnx"  # Directory for ONNX models

echo "Converting OPUS-MT models to CT2 format..."

# Function to download and convert OPUS-MT model
convert_opus_model() {
    local src_lang=$1
    local tgt_lang=$2
    local model_name="opus-mt-$src_lang-$tgt_lang"
    local model_dir="$OPUS_MT_DIR/$model_name"
    local ct2_dir="$OPUS_MT_DIR/$model_name-ct2"
    
    echo "Processing $model_name..."
    
    # Download model if it doesn't exist
    if [ ! -d "$model_dir" ]; then
        echo "Downloading $model_name from Hugging Face..."
        python -c "from transformers import MarianMTModel, MarianTokenizer; tokenizer = MarianTokenizer.from_pretrained('Helsinki-NLP/$model_name'); model = MarianMTModel.from_pretrained('Helsinki-NLP/$model_name', local_files_only=False); model.save_pretrained('$model_dir'); tokenizer.save_pretrained('$model_dir')"
    else
        echo "Model $model_name already exists in $model_dir"
    fi
    
    # Convert to CT2 if not already converted
    if [ ! -d "$ct2_dir" ]; then
        echo "Converting $model_name to CT2 format..."
        python "$PROJECT_ROOT/convert_opus_to_ct2.py" --model_path "$model_dir" --output_path "$ct2_dir" --quantization "float16" --device "cuda"
    else
        echo "CT2 model $model_name already exists in $ct2_dir"
    fi
}

# Convert English-Vietnamese and Vietnamese-English models
convert_opus_model "en" "vi"
convert_opus_model "vi" "en"

echo "OPUS-MT model conversion completed!"

# Optimize TTS to ONNX format
echo "Optimizing TTS model to ONNX format..."

# Check if TTS model exists
if [ ! -d "$TTS_DIR/XTTS-v2" ]; then
    echo "TTS model not found. Please download XTTS-v2 model first."
    echo "You can download it from the official repository or use the TTS service script."
    exit 1
fi

# Convert TTS to ONNX if needed
if [ ! -f "$TTS_DIR/XTTS-v2/onnx/decoder.onnx" ]; then
    echo "Converting TTS model to ONNX format..."
    
    # Convert to ONNX using a Python script or existing XTTS tools
    python -c "
import os
import sys
try:
    from TTS.utils.manage import ModelManager
    from TTS.api import TTS
    
    model_path = '$TTS_DIR/XTTS-v2'
    output_path = '$TTS_DIR/XTTS-v2/onnx'
    
    if not os.path.exists(output_path):
        os.makedirs(output_path)
    
    # Load the model 
    tts = TTS(model_path=model_path)
    
    # Export to ONNX
    print('Exporting XTTS model to ONNX format...')
    tts.export_onnx(output_path)
    
    print('XTTS model successfully converted to ONNX format!')
except ImportError as e:
    print(f'Error: {e}')
    print('Please install the required packages: pip install TTS onnx onnxruntime')
    sys.exit(1)
except Exception as e:
    print(f'Error converting TTS model to ONNX: {e}')
    sys.exit(1)
"
else
    echo "ONNX TTS model already exists in $TTS_DIR/XTTS-v2/onnx"
fi

echo "Optimizing configuration for c2d-standard-8 VM (8 vCPUs, 32GB Memory)..."

# Create optimized configuration file
cat > "$PROJECT_ROOT/server/.env.optimized" << EOF
# Optimized configuration for c2d-standard-8 VM (8 vCPUs, 32GB Memory)

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

# PhoWhisper ASR Service
MODEL_PATH_CT2=/app/models/phowhisper/PhoWhisper-medium-ct2
PORT_ASR=50051
OMP_NUM_THREADS=4
USE_CUDA=true
BEAM_SIZE=1
GPU_DEVICE=0
COMPUTE_TYPE=float16
CHUNK_LENGTH=0.4
VAD_FILTER=true
LOW_MEMORY=true
MAX_WORKERS=2
PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512

# Translation Service
OPUS_MODELS_BASE_PATH=/app/models/opus_mt
PORT_TRANSLATION=50052
MAX_LENGTH=512
BATCH_SIZE=16
NUM_WORKERS=4
CPU_THREADS=8
MAX_QUEUE_SIZE=32

# TTS Service
MODEL_PATH=/app/models/XTTS-v2
ONNX_MODEL_PATH=/app/models/XTTS-v2/onnx
PORT=5002
USE_ONNX=true
BATCH_SIZE=2
SPEAKER_WAV_PATH=/app/models/speakers
SAMPLE_RATE=24000
CHUNK_SIZE=150
MAX_WORKERS=2
LOW_MEMORY=true
EOF

echo "Created optimized configuration file: server/.env.optimized"

echo "Creating startup script..."
cat > "$PROJECT_ROOT/scripts/deploy/start_pipeline.sh" << EOF
#!/bin/bash
# Script to start the video call translation pipeline

set -e

echo "Starting Video Call Translation Pipeline..."

# Load optimized environment variables
if [ -f "$PROJECT_ROOT/server/.env.optimized" ]; then
    echo "Loading optimized configuration..."
    source "$PROJECT_ROOT/server/.env.optimized"
fi

# Start Docker services
cd "$PROJECT_ROOT"
docker-compose up -d

echo "Waiting for services to start up..."
sleep 10

# Check if services are running
echo "Checking services status..."

SERVICES=(
    "api"
    "socket"
    "phowhisper"
    "translation" 
    "tts"
    "embeddings"
    "redis"
)

ALL_RUNNING=true
for SERVICE in "\${SERVICES[@]}"; do
    STATUS=\$(docker-compose ps -q \$SERVICE | xargs docker inspect -f '{{.State.Status}}' 2>/dev/null || echo "not running")
    if [ "\$STATUS" != "running" ]; then
        echo "❌ \$SERVICE is not running. Status: \$STATUS"
        ALL_RUNNING=false
    else
        echo "✅ \$SERVICE is running"
    fi
done

if [ "\$ALL_RUNNING" = false ]; then
    echo "Some services failed to start. Check logs with 'docker-compose logs'"
    echo "You can restart individual services with 'docker-compose restart [service]'"
else
    echo "All services are running successfully!"
    echo "The system is accessible at: http://localhost:8081"
fi
EOF

chmod +x "$PROJECT_ROOT/scripts/deploy/start_pipeline.sh"

echo "Creating debugging script..."
cat > "$PROJECT_ROOT/scripts/deploy/debug_pipeline.sh" << EOF
#!/bin/bash
# Script to debug the video call translation pipeline

set -e

echo "Video Call Translation Pipeline Debugging"
echo "========================================"

# Function to show logs for a specific service
show_logs() {
    local service=\$1
    local lines=\${2:-50}
    
    echo "Showing last \$lines lines of logs for \$service..."
    docker-compose logs --tail=\$lines \$service
}

# Function to check resource usage
check_resources() {
    echo "Resource Usage for All Services:"
    docker stats --no-stream
}

# Function to restart a service
restart_service() {
    local service=\$1
    
    echo "Restarting \$service..."
    docker-compose restart \$service
    echo "\$service has been restarted."
}

# Function to check disk space
check_disk() {
    echo "Disk space usage:"
    df -h
    
    echo "Docker disk usage:"
    docker system df
}

# Function to clean up Docker resources
cleanup() {
    echo "Cleaning up Docker resources..."
    docker system prune -f
    echo "Removed unused Docker resources."
}

# Function to enter a container shell
enter_shell() {
    local service=\$1
    
    echo "Opening shell in \$service container..."
    docker-compose exec \$service bash || docker-compose exec \$service sh
}

# Menu
PS3="Select an option: "
options=(
    "Show logs" 
    "Check resource usage" 
    "Restart a service" 
    "Check disk space" 
    "Clean up Docker resources" 
    "Enter container shell"
    "Exit"
)

select opt in "\${options[@]}"; do
    case \$opt in
        "Show logs")
            echo "Available services: api socket phowhisper translation tts embeddings redis"
            read -p "Enter service name: " service
            read -p "How many log lines to show? [50]: " lines
            lines=\${lines:-50}
            show_logs \$service \$lines
            ;;
        "Check resource usage")
            check_resources
            ;;
        "Restart a service")
            echo "Available services: api socket phowhisper translation tts embeddings redis"
            read -p "Enter service name: " service
            restart_service \$service
            ;;
        "Check disk space")
            check_disk
            ;;
        "Clean up Docker resources")
            cleanup
            ;;
        "Enter container shell")
            echo "Available services: api socket phowhisper translation tts embeddings redis"
            read -p "Enter service name: " service
            enter_shell \$service
            ;;
        "Exit")
            echo "Exiting debug script."
            break
            ;;
        *) 
            echo "Invalid option \$REPLY"
            ;;
    esac
    echo ""
    echo "Debug script menu:"
done
EOF

chmod +x "$PROJECT_ROOT/scripts/deploy/debug_pipeline.sh"

echo "Creating optimized docker-compose configuration..."
cat > "$PROJECT_ROOT/scripts/deploy/docker-compose.optimized.yml" << 'EOF'
version: '3.8'

services:
  traefik:
    image: traefik:v2.9
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:8081"
      - "--log.level=INFO"
    ports:
      - "8081:8081"
      - "8082:8080"  # Traefik dashboard
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
    networks:
      - translation-network

  api:
    build:
      context: .
      dockerfile: ./scripts/deploy/docker/Dockerfile.api
    environment:
      - NODE_ENV=production
      - PORT=5000
      - REDIS_URL=redis://redis:6379
      - PHOWHISPER_ASR_URL=http://phowhisper:50051
      - TRANSLATION_SERVICE_URL=http://translation:50052
      - TTS_SERVICE_URL=http://tts:5002
      - EMBEDDING_SERVICE_URL=http://embeddings:5003
      - CORS_ORIGIN=*
    volumes:
      - ./server:/app/server
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.api.rule=PathPrefix(`/api`)"
      - "traefik.http.services.api-service.loadbalancer.server.port=5000"
      - "traefik.http.middlewares.api-cors.headers.accessControlAllowOriginList=*"
      - "traefik.http.routers.api.middlewares=api-cors@docker"
    networks:
      - translation-network
    depends_on:
      - redis
      - phowhisper
      - translation
    command: npm run dev:api

  socket:
    build:
      context: .
      dockerfile: ./scripts/deploy/docker/Dockerfile.socket
    environment:
      - NODE_ENV=production
      - PORT=5001
      - REDIS_URL=redis://redis:6379
      - PHOWHISPER_ASR_URL=http://phowhisper:50051
      - TRANSLATION_SERVICE_URL=http://translation:50052
      - TTS_SERVICE_URL=http://tts:5002
      - EMBEDDING_SERVICE_URL=http://embeddings:5003
      - CORS_ORIGIN=*
    volumes:
      - ./server:/app/server
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.socket.rule=PathPrefix(`/socket.io`)"
      - "traefik.http.services.socket-service.loadbalancer.server.port=5001"
      - "traefik.http.middlewares.socket-cors.headers.accessControlAllowOriginList=*"
      - "traefik.http.routers.socket.middlewares=socket-cors@docker"
    networks:
      - translation-network
    depends_on:
      - redis
      - phowhisper
      - translation
    command: npm run dev:socket

  phowhisper:
    build:
      context: ./server/services/phowhisper_asr_service
      dockerfile: Dockerfile
    volumes:
      - ./server/models/phowhisper:/app/models/phowhisper:rw
      - phowhisper-cache:/root/.cache
    environment:
      - MODEL_PATH_CT2=/app/models/phowhisper/PhoWhisper-medium-ct2
      - PORT_ASR=50051
      - OMP_NUM_THREADS=4
      - USE_CUDA=true
      - BEAM_SIZE=1
      - GPU_DEVICE=0
      - COMPUTE_TYPE=float16
      - CHUNK_LENGTH=0.4
      - VAD_FILTER=true
      - LOW_MEMORY=true
      - MAX_WORKERS=2
      - PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
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
    networks:
      - translation-network

  translation:
    build:
      context: ./server/services/translation_service
      dockerfile: Dockerfile
    volumes:
      - ./server/models/opus_mt:/app/models/opus_mt:ro
      - translation-cache:/root/.cache
    environment:
      - OPUS_MODELS_BASE_PATH=/app/models/opus_mt
      - PORT_TRANSLATION=50052
      - USE_CUDA=true
      - MAX_LENGTH=512
      - BATCH_SIZE=16
      - GPU_DEVICE=0
      - OMP_NUM_THREADS=4
      - NUM_WORKERS=4
      - CPU_THREADS=8
      - MAX_QUEUE_SIZE=32
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
    networks:
      - translation-network

  tts:
    build:
      context: ./server/services/tts_service
      dockerfile: Dockerfile
    volumes:
      - ./server/models/tts:/app/models:rw
      - tts-cache:/root/.cache
    environment:
      - MODEL_PATH=/app/models/XTTS-v2
      - ONNX_MODEL_PATH=/app/models/XTTS-v2/onnx
      - PORT=5002
      - USE_CUDA=true
      - USE_ONNX=true
      - BATCH_SIZE=2
      - SPEAKER_WAV_PATH=/app/models/speakers
      - SAMPLE_RATE=24000
      - GPU_DEVICE=0
      - PYTORCH_CUDA_ALLOC_CONF=max_split_size_mb:512
      - OMP_NUM_THREADS=4
      - CHUNK_SIZE=150
      - MAX_WORKERS=2
      - LOW_MEMORY=true
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
    networks:
      - translation-network

  embeddings:
    build:
      context: ./server/services/embeddings_service
      dockerfile: Dockerfile
    volumes:
      - ./server/models/embeddings:/app/data:rw
      - embeddings-cache:/root/.cache
    environment:
      - EMBEDDING_MODEL=all-MiniLM-L6-v2
      - PORT=5003
      - ENABLE_CACHE=true
      - CACHE_DIR=/app/data
      - USE_CUDA=true
      - BATCH_SIZE=32
      - GPU_DEVICE=0
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 1G
    networks:
      - translation-network

  client:
    build:
      context: ./client
      dockerfile: Dockerfile
      args:
        - VITE_API_URL=/api
        - VITE_SOCKET_URL=/socket.io
        - VITE_ENVIRONMENT=production
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.client.rule=PathPrefix(`/`)"
      - "traefik.http.services.client-service.loadbalancer.server.port=80"
      - "traefik.http.routers.client.priority=1"
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
    networks:
      - translation-network

  redis:
    image: redis:7-alpine
    command: redis-server --save 60 1 --loglevel warning
    volumes:
      - redis-data:/data
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
    networks:
      - translation-network

volumes:
  redis-data:
  phowhisper-cache:
  translation-cache:
  tts-cache:
  embeddings-cache:

networks:
  translation-network:
    driver: bridge
EOF

echo "======================================================="
echo "Optimization scripts created successfully!"
echo "1. To convert models and optimize the system, run:"
echo "   bash $PROJECT_ROOT/scripts/deploy/convert_and_optimize.sh"
echo ""
echo "2. To start the pipeline, run:"
echo "   bash $PROJECT_ROOT/scripts/deploy/start_pipeline.sh"
echo ""
echo "3. For debugging issues, run:"
echo "   bash $PROJECT_ROOT/scripts/deploy/debug_pipeline.sh"
echo ""
echo "4. To use the optimized docker-compose configuration:"
echo "   docker-compose -f docker-compose.yml -f scripts/deploy/docker-compose.optimized.yml up -d"
echo "======================================================="

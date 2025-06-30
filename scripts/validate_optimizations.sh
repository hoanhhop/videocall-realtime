#!/bin/bash
# Script to validate optimizations for video-call-translation system
# This checks if all optimizations have been correctly applied for the c2d-standard-8 VM

# Terminal colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}Video Call Translation - Optimization Validation${NC}"
echo -e "${BLUE}====================================================${NC}"
echo ""

# Define project root directory
PROJECT_ROOT=$(cd "$(dirname "$0")/.." && pwd)
VALIDATION_SUCCESS=true

# Function to check if a file exists
check_file_exists() {
  local file_path="$1"
  local description="$2"
  
  if [ -e "$file_path" ]; then
    echo -e "✅ ${GREEN}$description: Present${NC}"
    return 0
  else
    echo -e "❌ ${RED}$description: Missing${NC}"
    VALIDATION_SUCCESS=false
    return 1
  fi
}

# Function to check Docker configuration
check_docker_config() {
  local file_path="$1"
  local description="$2"
  
  if [ -e "$file_path" ]; then
    if grep -q "resources" "$file_path" && grep -q "limits" "$file_path"; then
      echo -e "✅ ${GREEN}$description: Present with resource limits${NC}"
      return 0
    else
      echo -e "⚠️ ${YELLOW}$description: Present but missing resource limits${NC}"
      return 1
    fi
  else
    echo -e "❌ ${RED}$description: Missing${NC}"
    VALIDATION_SUCCESS=false
    return 1
  fi
}

# Function to check model conversion status
check_model_converted() {
  local source_path="$1"
  local converted_path="$2"
  local model_type="$3"
  
  local source_exists=false
  local converted_exists=false
  
  [ -d "$source_path" ] && source_exists=true
  [ -d "$converted_path" ] && converted_exists=true
  
  if $source_exists && $converted_exists; then
    echo -e "✅ ${GREEN}$model_type Model Conversion: Source and converted models present${NC}"
    return 0
  elif $source_exists && ! $converted_exists; then
    echo -e "⚠️ ${YELLOW}$model_type Model Conversion: Source present but not converted${NC}"
    return 1
  elif ! $source_exists && ! $converted_exists; then
    echo -e "❌ ${RED}$model_type Model Conversion: Neither source nor converted models present${NC}"
    VALIDATION_SUCCESS=false
    return 1
  else
    echo -e "✅ ${GREEN}$model_type Model Conversion: Converted model present (Pre-converted)${NC}"
    return 0
  fi
}

# Check for optimization script
echo -e "${YELLOW}Checking optimization scripts...${NC}"
check_file_exists "$PROJECT_ROOT/scripts/optimize_for_c2d_vm.sh" "c2d-standard-8 VM Optimization Script"
check_file_exists "$PROJECT_ROOT/optimize_vm.sh" "System Optimization Script"

# Check Docker configurations
echo -e "${YELLOW}Checking Docker configuration files...${NC}"
check_docker_config "$PROJECT_ROOT/docker-compose.optimized.yml" "Docker Compose Optimization File"

# Check model conversion scripts
echo -e "${YELLOW}Checking model conversion scripts...${NC}"
check_file_exists "$PROJECT_ROOT/convert_opus_to_ct2.py" "OPUS-MT to CT2 Conversion Script"
check_file_exists "$PROJECT_ROOT/convert_xtts_to_onnx.py" "XTTS to ONNX Conversion Script"

# Check model directories
echo -e "${YELLOW}Checking model directories...${NC}"
MODELS_DIR="$PROJECT_ROOT/server/models"
check_file_exists "$MODELS_DIR/opus_mt" "OPUS-MT Models Directory"
check_file_exists "$MODELS_DIR/phowhisper" "PhoWhisper Models Directory"
check_file_exists "$MODELS_DIR/tts" "TTS Models Directory"

# Check converted models
echo -e "${YELLOW}Checking model conversion status...${NC}"
check_model_converted "$MODELS_DIR/opus_mt/opus-mt-en-vi" "$MODELS_DIR/opus_mt/opus-mt-en-vi-ct2" "OPUS-MT English-Vietnamese"
check_model_converted "$MODELS_DIR/opus_mt/opus-mt-vi-en" "$MODELS_DIR/opus_mt/opus-mt-vi-en-ct2" "OPUS-MT Vietnamese-English"
check_model_converted "$MODELS_DIR/tts/XTTS-v2" "$MODELS_DIR/tts/XTTS-v2/onnx" "XTTS-v2 ONNX"

# Check environment configuration
echo -e "${YELLOW}Checking environment configuration...${NC}"
ENV_FILE="$PROJECT_ROOT/server/.env.optimized"
if [ -f "$ENV_FILE" ]; then
  for check in "USE_CUDA=true:CUDA Enabled" "COMPUTE_TYPE=float16:ASR FP16 Optimization" \
               "BATCH_SIZE=16:Translation Batch Size Optimized" "USE_ONNX=true:ONNX Runtime for TTS" \
               "LOW_MEMORY=true:Low Memory Optimization"; do
    pattern=$(echo $check | cut -d':' -f1)
    description=$(echo $check | cut -d':' -f2)
    
    if grep -q "$pattern" "$ENV_FILE"; then
      echo -e "✅ ${GREEN}Environment Config: $description: Configured${NC}"
    else
      echo -e "⚠️ ${YELLOW}Environment Config: $description: Not configured${NC}"
    fi
  done
else
  echo -e "❌ ${RED}Optimized Environment Configuration: Missing${NC}"
  VALIDATION_SUCCESS=false
fi

# Check start script
echo -e "${YELLOW}Checking start scripts...${NC}"
check_file_exists "$PROJECT_ROOT/start_optimized.sh" "Optimized Start Script (Linux)"

# Summary
echo ""
echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}Optimization Validation Summary${NC}"
echo -e "${BLUE}====================================================${NC}"

if $VALIDATION_SUCCESS; then
  echo -e "${GREEN}All critical optimizations are in place!${NC}"
  echo -e "${GREEN}The system is optimized for c2d-standard-8 VM (8 vCPUs, 32 GB Memory).${NC}"
else
  echo -e "${YELLOW}Some optimizations are missing or incomplete.${NC}"
  echo -e "${YELLOW}Please run the optimization scripts to fully optimize the system.${NC}"
  echo ""
  echo -e "${YELLOW}Recommended actions:${NC}"
  echo -e "${YELLOW}1. Run scripts/optimize_for_c2d_vm.sh to apply all optimizations${NC}"
  echo -e "${YELLOW}2. Check if models are properly converted using the conversion scripts${NC}"
  echo -e "${YELLOW}3. Ensure Docker is configured with resource limits${NC}"
fi

echo ""
echo -e "${BLUE}====================================================${NC}"
echo -e "${BLUE}To start the optimized system:${NC}"
echo -e "${BLUE}  ./start_optimized.sh${NC}"
echo -e "${BLUE}====================================================${NC}"

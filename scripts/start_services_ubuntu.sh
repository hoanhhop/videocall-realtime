#!/bin/bash
# Script khởi động các dịch vụ Python trên Ubuntu

# Xác định các màu cho log
CYAN='\033[0;36m'
GREEN='\033[0;32m'
MAGENTA='\033[0;35m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
RESET='\033[0m'

# Tìm thư mục gốc của dự án
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"

# Đường dẫn đến Python trong môi trường ảo
PYTHON_CMD="$PROJECT_ROOT/venv/bin/python"

# Đường dẫn đến các dịch vụ
declare -A SERVICES
SERVICES=(
  ["PhoWhisper ASR"]="server/services/phowhisper_asr_service/run_phowhisper.py:${CYAN}:50051:0"
  ["Translation"]="server/services/translation_service/run_translation.py:${GREEN}:50052:5"
  ["TTS"]="server/services/tts_service/run_tts.py:${MAGENTA}:5002:10"
)

# Mảng lưu trữ các PID của tiến trình con
declare -a SERVICE_PIDS

# Hàm khởi động dịch vụ
start_service() {
  local service_name=$1
  local service_info=${SERVICES[$service_name]}
  
  # Phân tách thông tin dịch vụ
  IFS=':' read -ra SERVICE_DATA <<< "$service_info"
  local script_path=${SERVICE_DATA[0]}
  local color=${SERVICE_DATA[1]}
  local port=${SERVICE_DATA[2]}
  local delay=${SERVICE_DATA[3]}
  
  # Kiểm tra xem có delay không
  if [ -n "$delay" ] && [ "$delay" -gt 0 ]; then
    echo -e "${color}Đợi ${delay}s trước khi khởi động ${service_name}...${RESET}"
    sleep $delay
  fi
  
  echo -e "${color}Khởi động ${service_name} Service...${RESET}"
  
  # Tạo lệnh chạy dịch vụ
  cd $PROJECT_ROOT
  $PYTHON_CMD $script_path > "$PROJECT_ROOT/logs/${service_name// /_}.log" 2>&1 &
  local service_pid=$!
  SERVICE_PIDS+=($service_pid)
  
  echo -e "${color}[${service_name}] Đã khởi động với PID ${service_pid}${RESET}"
  
  # Kiểm tra xem dịch vụ có khởi động thành công không
  sleep 2
  if kill -0 $service_pid 2>/dev/null; then
    echo -e "${color}[${service_name}] Dịch vụ đang chạy trên cổng ${port}${RESET}"
  else
    echo -e "${RED}[${service_name}] Lỗi: Dịch vụ không thể khởi động. Kiểm tra logs/${service_name// /_}.log${RESET}"
  fi
}

# Hàm dừng tất cả các dịch vụ
stop_all_services() {
  echo -e "${YELLOW}Đang dừng tất cả các dịch vụ...${RESET}"
  
  for pid in "${SERVICE_PIDS[@]}"; do
    if kill -0 $pid 2>/dev/null; then
      echo -e "${YELLOW}Dừng tiến trình với PID ${pid}${RESET}"
      kill $pid
    fi
  done
  
  echo -e "${YELLOW}Tất cả các dịch vụ đã được dừng${RESET}"
  exit 0
}

# Tạo thư mục logs nếu chưa tồn tại
mkdir -p "$PROJECT_ROOT/logs"

# Đăng ký bẫy tín hiệu để dừng tất cả các dịch vụ khi Ctrl+C
trap stop_all_services INT TERM

# Thông báo bắt đầu
echo -e "${YELLOW}=== Khởi động các dịch vụ Python ===${RESET}"

# Khởi động từng dịch vụ theo thứ tự
for service_name in "${!SERVICES[@]}"; do
  start_service "$service_name"
done

echo -e "${YELLOW}=== Tất cả các dịch vụ đã được khởi động ===${RESET}"
echo -e "${YELLOW}Nhấn Ctrl+C để dừng tất cả các dịch vụ${RESET}"

# Chờ đợi tín hiệu tắt
while true; do
  sleep 1
  
  # Kiểm tra xem các dịch vụ có còn chạy không
  for i in "${!SERVICE_PIDS[@]}"; do
    pid=${SERVICE_PIDS[$i]}
    if ! kill -0 $pid 2>/dev/null; then
      service_name=$(echo "${!SERVICES[@]}" | cut -d ' ' -f$((i+1)))
      echo -e "${RED}[${service_name}] Dịch vụ đã dừng không mong muốn với PID ${pid}${RESET}"
      # Khởi động lại dịch vụ nếu cần
      # start_service "$service_name"
    fi
  done
done 

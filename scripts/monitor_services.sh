#!/bin/bash
# Monitoring script for Video Call Translation system
# Use this to monitor service health, logs, and resources

# Terminal colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Find project root directory
PROJECT_ROOT=$(cd "$(dirname "$0")/.." && pwd)

# Function to display the menu
display_menu() {
  clear
  echo -e "${BLUE}===================================================${NC}"
  echo -e "${BLUE}Video Call Translation - Service Monitoring Tool${NC}"
  echo -e "${BLUE}===================================================${NC}"
  echo -e ""
  echo -e "Choose an option:"
  echo -e "  ${CYAN}1)${NC} Show status of all services"
  echo -e "  ${CYAN}2)${NC} View logs for a specific service"
  echo -e "  ${CYAN}3)${NC} Restart a specific service"
  echo -e "  ${CYAN}4)${NC} Check resource usage"
  echo -e "  ${CYAN}5)${NC} Clean Docker cache"
  echo -e "  ${CYAN}6)${NC} Check optimizations status"
  echo -e "  ${CYAN}7)${NC} Exit"
  echo -e ""
  read -p "Enter choice [1-7]: " choice
  
  case $choice in
    1) show_status ;;
    2) view_logs ;;
    3) restart_service ;;
    4) check_resources ;;
    5) clean_cache ;;
    6) check_optimizations ;;
    7) echo -e "${GREEN}Exiting monitoring tool.${NC}"; exit 0 ;;
    *) echo -e "${RED}Invalid choice.${NC}"; sleep 2; display_menu ;;
  esac
}

# Function to show status of all services
show_status() {
  echo -e "${YELLOW}Checking service status...${NC}"
  docker-compose ps
  echo -e ""
  read -p "Press Enter to continue..."
  display_menu
}

# Function to view logs for a specific service
view_logs() {
  echo -e "${BLUE}Available services:${NC}"
  echo -e "- traefik"
  echo -e "- api"
  echo -e "- socket"
  echo -e "- phowhisper"
  echo -e "- translation"
  echo -e "- tts"
  echo -e "- embeddings"
  echo -e "- client"
  echo -e "- redis"
  echo -e ""
  
  read -p "Enter service name: " service
  read -p "How many lines to show [50]: " lines
  
  if [ -z "$lines" ]; then
    lines=50
  fi
  
  echo -e "${YELLOW}=== Logs for $service (last $lines lines) ===${NC}"
  docker-compose logs --tail="$lines" "$service"
  echo -e ""
  
  read -p "Press Enter to continue..."
  display_menu
}

# Function to restart a specific service
restart_service() {
  echo -e "${BLUE}Available services:${NC}"
  echo -e "- traefik"
  echo -e "- api"
  echo -e "- socket"
  echo -e "- phowhisper"
  echo -e "- translation"
  echo -e "- tts"
  echo -e "- embeddings"
  echo -e "- client"
  echo -e "- redis"
  echo -e ""
  
  read -p "Enter service name to restart: " service
  
  echo -e "${YELLOW}Restarting $service...${NC}"
  docker-compose restart "$service"
  echo -e "${GREEN}$service restarted.${NC}"
  echo -e ""
  
  read -p "Press Enter to continue..."
  display_menu
}

# Function to check resource usage
check_resources() {
  echo -e "${YELLOW}=== Resource Usage ===${NC}"
  docker stats --no-stream
  echo -e ""
  
  read -p "Press Enter to continue..."
  display_menu
}

# Function to clean Docker cache
clean_cache() {
  echo -e "${YELLOW}Cleaning Docker cache...${NC}"
  
  read -p "This will remove all unused containers, networks, and images. Continue? (y/n): " confirm
  if [[ "$confirm" =~ ^[Yy]$ ]]; then
    docker system prune -f
    echo -e "${GREEN}Docker cache cleaned.${NC}"
  else
    echo -e "${YELLOW}Operation cancelled.${NC}"
  fi
  
  echo -e ""
  read -p "Press Enter to continue..."
  display_menu
}

# Function to check optimizations status
check_optimizations() {
  echo -e "${YELLOW}Checking optimizations status...${NC}"
  
  if [ -f "$PROJECT_ROOT/scripts/validate_optimizations.sh" ]; then
    bash "$PROJECT_ROOT/scripts/validate_optimizations.sh"
  else
    echo -e "${RED}Optimization validation script not found.${NC}"
    echo -e "${YELLOW}Make sure you have the latest version of the codebase.${NC}"
  fi
  
  echo -e ""
  read -p "Press Enter to continue..."
  display_menu
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
  echo -e "${RED}Docker is not running. Please start Docker and try again.${NC}"
  exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
  echo -e "${RED}Docker Compose is not installed. Please install Docker Compose and try again.${NC}"
  exit 1
fi

# Start the menu
display_menu

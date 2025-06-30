#!/usr/bin/env python3
"""
Script kiểm tra tính sẵn sàng của hệ thống Video Call Translation
- Kiểm tra cài đặt Python và thư viện
- Kiểm tra GPU và CUDA
- Kiểm tra sự tồn tại và kích thước của các model
- Kiểm tra kết nối giữa các dịch vụ (tùy chọn)
"""

import os
import sys
import shutil
import platform
import subprocess
from pathlib import Path

# Thiết lập đường dẫn gốc dự án
PROJECT_ROOT = Path(__file__).parent.parent.absolute()
SERVER_DIR = PROJECT_ROOT / "server"
MODELS_DIR = SERVER_DIR / "models"

# Màu sắc cho terminal output
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'

def print_status(message, status="INFO"):
    color = Colors.BLUE
    if status == "OK":
        color = Colors.GREEN
    elif status == "WARNING":
        color = Colors.YELLOW
    elif status == "ERROR":
        color = Colors.RED
    
    print(f"{color}[{status}]{Colors.ENDC} {message}")

def print_section(title):
    print(f"\n{Colors.BOLD}=== {title} ==={Colors.ENDC}\n")

def check_python_version():
    print_section("Kiểm tra Python và thư viện")
    version = platform.python_version()
    print_status(f"Phiên bản Python: {version}", "INFO")
    
    if tuple(map(int, version.split('.'))) < (3, 9):
        print_status("Python 3.9 trở lên được khuyến nghị", "WARNING")
    else:
        print_status("Phiên bản Python OK", "OK")
    
    try:
        import torch
        print_status(f"PyTorch đã cài đặt: {torch.__version__}", "OK")
        
        # Kiểm tra CUDA support
        if torch.cuda.is_available():
            print_status(f"CUDA khả dụng: {torch.version.cuda}", "OK")
            print_status(f"Số lượng GPU: {torch.cuda.device_count()}", "OK")
            for i in range(torch.cuda.device_count()):
                print_status(f"  GPU {i}: {torch.cuda.get_device_name(i)}", "INFO")
        else:
            print_status("CUDA không khả dụng - hệ thống sẽ chạy trên CPU", "WARNING")
    except ImportError:
        print_status("PyTorch chưa được cài đặt", "ERROR")
    
    # Kiểm tra các thư viện then chốt khác
    libs_to_check = [
        "flask", "transformers", "ctranslate2", "sentencepiece", 
        "faster_whisper", "scipy", "librosa", "TTS"
    ]
    
    for lib in libs_to_check:
        try:
            module = __import__(lib)
            print_status(f"{lib} đã cài đặt", "OK")
        except ImportError:
            print_status(f"{lib} chưa được cài đặt", "WARNING")

def check_model_files():
    print_section("Kiểm tra các file model")
    
    models_to_check = {
        "PhoWhisper ASR": MODELS_DIR / "phowhisper" / "PhoWhisper-base-ct2",
        "OPUS-MT English-Vietnamese": MODELS_DIR / "opus_mt" / "en_vi_model",
        "OPUS-MT Vietnamese-English": MODELS_DIR / "opus_mt" / "vi_en_model",
        "XTTS-v2": MODELS_DIR / "tts" / "XTTS-v2"
    }
    
    for name, path in models_to_check.items():
        if path.exists():
            size = get_dir_size(path)
            print_status(f"{name}: {path} ({size:.1f} MB)", "OK")
        else:
            print_status(f"{name}: {path} không tồn tại", "ERROR")

def check_system_resources():
    print_section("Kiểm tra tài nguyên hệ thống")
    
    # CPU cores
    try:
        import multiprocessing
        cpu_count = multiprocessing.cpu_count()
        print_status(f"Số CPU cores: {cpu_count}", "OK" if cpu_count >= 4 else "WARNING")
    except:
        print_status("Không thể xác định số CPU cores", "WARNING")
    
    # RAM
    try:
        import psutil
        total_ram = psutil.virtual_memory().total / (1024**3)  # GB
        print_status(f"Tổng RAM: {total_ram:.1f} GB", "OK" if total_ram >= 8 else "WARNING")
    except:
        print_status("Không thể xác định lượng RAM - cần cài đặt 'psutil'", "WARNING")
    
    # Disk space
    try:
        free_disk = shutil.disk_usage(str(PROJECT_ROOT)).free / (1024**3)  # GB
        print_status(f"Dung lượng ổ đĩa trống: {free_disk:.1f} GB", 
                   "OK" if free_disk >= 20 else "WARNING")
    except:
        print_status("Không thể xác định dung lượng ổ đĩa trống", "WARNING")

def check_nodejs():
    print_section("Kiểm tra Node.js")
    
    try:
        node_version = subprocess.check_output(["node", "--version"], 
                                             text=True).strip()
        print_status(f"Node.js version: {node_version}", "OK")
        
        if not node_version.startswith("v14.") and not node_version.startswith("v16.") and not node_version.startswith("v18."):
            print_status("Node.js >= 14 được khuyến nghị", "WARNING")
    except:
        print_status("Không thể xác định phiên bản Node.js", "ERROR")
    
    # Kiểm tra package.json và các dependencies
    package_json = PROJECT_ROOT / "package.json"
    if package_json.exists():
        print_status("package.json: Tồn tại", "OK")
        
        # Kiểm tra package-lock.json
        package_lock = PROJECT_ROOT / "package-lock.json"
        if package_lock.exists():
            print_status("package-lock.json: Tồn tại", "OK")
        else:
            print_status("package-lock.json không tồn tại - cần chạy 'npm install'", "ERROR")
    else:
        print_status("package.json không tồn tại", "ERROR")

def get_dir_size(path):
    """Tính kích thước thư mục theo MB"""
    total_size = 0
    for dirpath, dirnames, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if os.path.exists(fp):
                total_size += os.path.getsize(fp)
    return total_size / (1024 * 1024)  # MB

def check_docker():
    print_section("Kiểm tra Docker")
    
    try:
        docker_version = subprocess.check_output(["docker", "--version"], 
                                              text=True).strip()
        print_status(f"Docker: {docker_version}", "OK")
    except:
        print_status("Docker chưa được cài đặt hoặc không khả dụng", "WARNING")
    
    try:
        compose_version = subprocess.check_output(["docker-compose", "--version"], 
                                               text=True).strip()
        print_status(f"Docker Compose: {compose_version}", "OK")
    except:
        try:
            compose_version = subprocess.check_output(["docker", "compose", "version"], 
                                                  text=True).strip()
            print_status(f"Docker Compose (Docker CLI plugin): {compose_version}", "OK")
        except:
            print_status("Docker Compose chưa được cài đặt", "WARNING")
    
    # Kiểm tra docker-compose.yml
    docker_compose_file = PROJECT_ROOT / "docker-compose.yml"
    docker_compose_file_deploy = PROJECT_ROOT / "deploy" / "docker-compose.yml"
    
    if docker_compose_file.exists():
        print_status("File docker-compose.yml: Tồn tại", "OK")
    elif docker_compose_file_deploy.exists():
        print_status("File docker-compose.yml tồn tại trong thư mục deploy/", "OK")
    else:
        print_status("File docker-compose.yml không tìm thấy", "ERROR")

if __name__ == "__main__":
    print(f"{Colors.BOLD}KIỂM TRA TÍNH SẴN SÀNG HỆ THỐNG VIDEO CALL TRANSLATION{Colors.ENDC}")
    print(f"Thư mục dự án: {PROJECT_ROOT}")
    
    check_python_version()
    check_nodejs()
    check_model_files()
    check_system_resources()
    check_docker()
    
    print("\nKiểm tra hoàn tất! Vui lòng xem các cảnh báo hoặc lỗi cần xử lý.") 
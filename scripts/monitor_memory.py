#!/usr/bin/env python
# -*- coding: utf-8 -*-
# monitor_memory.py - Script giám sát và dọn dẹp bộ nhớ tự động

import os
import time
import subprocess
import logging
import sys
import psutil
import argparse
from datetime import datetime

# Cấu hình logging tối thiểu
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('memory_monitor.log', mode='w')  # Ghi đè file log cũ
    ]
)
logger = logging.getLogger("MemoryMonitor")

def get_container_ids():
    """Lấy danh sách các container ID đang chạy"""
    try:
        result = subprocess.run(
            ["docker", "ps", "--format", "{{.ID}}"],
            capture_output=True, text=True, check=True
        )
        return result.stdout.strip().split('\n')
    except Exception as e:
        logger.error(f"Không thể lấy danh sách container: {e}")
        return []

def clean_container_cache(container_id):
    """Dọn dẹp cache trong container"""
    try:
        # Xóa các file cache tạm
        subprocess.run([
            "docker", "exec", container_id,
            "sh", "-c", "rm -rf /tmp/.cache/* /tmp/torch* /tmp/*.tmp 2>/dev/null || true"
        ], check=False)
        return True
    except Exception as e:
        logger.error(f"Lỗi khi dọn dẹp cache container {container_id}: {e}")
        return False

def get_memory_usage():
    """Lấy thông tin sử dụng bộ nhớ hệ thống"""
    memory = psutil.virtual_memory()
    return {
        "total": memory.total / (1024 ** 3),  # GB
        "available": memory.available / (1024 ** 3),  # GB
        "percent": memory.percent
    }

def monitor_and_clean(threshold=85, interval=60, max_logs=10):
    """Giám sát và dọn dẹp bộ nhớ khi quá ngưỡng"""
    log_count = 0
    last_clean_time = 0
    
    logger.info(f"Bắt đầu giám sát bộ nhớ - Ngưỡng: {threshold}%, Khoảng thời gian: {interval}s")
    
    while True:
        try:
            # Kiểm tra bộ nhớ
            memory = get_memory_usage()
            
            # Ghi log mỗi 10 lần giám sát
            if log_count % 10 == 0:
                logger.info(f"Bộ nhớ: {memory['percent']:.1f}% sử dụng, {memory['available']:.2f}GB khả dụng")
                log_count = 0
            log_count += 1
            
            current_time = time.time()
            time_since_last_clean = current_time - last_clean_time
            
            # Nếu bộ nhớ vượt ngưỡng và đã đủ thời gian từ lần dọn trước đó
            if memory["percent"] > threshold and time_since_last_clean > 300:  # 5 phút
                logger.warning(f"Bộ nhớ đạt {memory['percent']:.1f}% - Đang dọn dẹp cache...")
                
                # Dọn dẹp các container
                container_ids = get_container_ids()
                for container_id in container_ids:
                    if container_id:
                        clean_container_cache(container_id)
                
                # Cập nhật thời điểm dọn dẹp
                last_clean_time = current_time
                logger.info("Đã dọn dẹp cache các container")
            
            # Ngủ trong khoảng thời gian quy định
            time.sleep(interval)
            
        except KeyboardInterrupt:
            logger.info("Đã dừng giám sát bộ nhớ")
            break
        except Exception as e:
            logger.error(f"Lỗi: {e}")
            time.sleep(interval)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Giám sát và tự động dọn dẹp bộ nhớ")
    parser.add_argument(
        "--threshold", type=int, default=85,
        help="Ngưỡng phần trăm bộ nhớ để kích hoạt dọn dẹp (mặc định: 85)"
    )
    parser.add_argument(
        "--interval", type=int, default=60,
        help="Khoảng thời gian giữa các lần kiểm tra (giây, mặc định: 60)"
    )
    
    args = parser.parse_args()
    
    monitor_and_clean(args.threshold, args.interval)

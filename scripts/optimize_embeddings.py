#!/usr/bin/env python
# -*- coding: utf-8 -*-
# optimize_embeddings.py - Script tối ưu hóa mô hình embeddings cho hệ thống dịch thuật

import os
import argparse
import logging
import torch
import json
import sys
from pathlib import Path
from sentence_transformers import SentenceTransformer

# Cấu hình logging
logging.basicConfig(
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

# Thư mục gốc cho mô hình embeddings
EMBEDDINGS_DIR = os.path.join("server", "models", "embeddings")
CACHE_DIR = os.path.join(EMBEDDINGS_DIR, "cache")
CONFIG_FILE = os.path.join(EMBEDDINGS_DIR, "config.json")

# Danh sách mô hình có sẵn
AVAILABLE_MODELS = {
    "paraphrase-multilingual-MiniLM-L12-v2": {
        "description": "Mô hình đa ngôn ngữ nhỏ, hỗ trợ 50+ ngôn ngữ, kích thước 400MB",
        "dims": 384,
        "languages": ["en", "vi", "ja", "zh", "ko", "th", "fr", "es", "de", "ru"],
    },
    "paraphrase-multilingual-mpnet-base-v2": {
        "description": "Mô hình đa ngôn ngữ chất lượng cao, hỗ trợ 50+ ngôn ngữ, kích thước 1.1GB",
        "dims": 768,
        "languages": ["en", "vi", "ja", "zh", "ko", "th", "fr", "es", "de", "ru"],
    },
    "all-MiniLM-L6-v2": {
        "description": "Mô hình nhỏ và nhanh, chủ yếu cho tiếng Anh, kích thước 80MB",
        "dims": 384,
        "languages": ["en"],
    }
}

def setup_embeddings_dir():
    """Thiết lập thư mục cho dịch vụ embeddings"""
    os.makedirs(EMBEDDINGS_DIR, exist_ok=True)
    os.makedirs(CACHE_DIR, exist_ok=True)
    
    logger.info(f"Đã tạo thư mục embeddings tại {EMBEDDINGS_DIR}")
    logger.info(f"Đã tạo thư mục cache tại {CACHE_DIR}")
    
    return True

def download_model(model_name="paraphrase-multilingual-MiniLM-L12-v2"):
    """Tải mô hình embedding từ Hugging Face"""
    if model_name not in AVAILABLE_MODELS:
        logger.error(f"Mô hình {model_name} không có trong danh sách hỗ trợ")
        return False
    
    try:
        logger.info(f"Tải mô hình {model_name}...")
        # Tải và lưu vào cache
        model = SentenceTransformer(model_name, cache_folder=CACHE_DIR)
        model_path = model._model_card_vars["modelPath"]
        
        logger.info(f"Đã tải mô hình thành công, lưu tại {model_path}")
        
        # Lưu thông tin cấu hình
        config = {
            "model_name": model_name,
            "embedding_dimension": AVAILABLE_MODELS[model_name]["dims"],
            "languages": AVAILABLE_MODELS[model_name]["languages"],
            "cache_path": CACHE_DIR,
            "model_path": model_path,
            "description": AVAILABLE_MODELS[model_name]["description"],
        }
        
        with open(CONFIG_FILE, "w") as f:
            json.dump(config, f, indent=2)
        
        logger.info(f"Đã lưu cấu hình mô hình vào {CONFIG_FILE}")
        return True
    
    except Exception as e:
        logger.error(f"Lỗi khi tải mô hình {model_name}: {e}")
        return False

def optimize_for_hardware():
    """Tối ưu hóa cấu hình cho phần cứng hiện tại"""
    # Kiểm tra GPU
    if torch.cuda.is_available():
        cuda_device = torch.cuda.get_device_properties(0)
        logger.info(f"Phát hiện GPU: {cuda_device.name} với {cuda_device.total_memory / 1024**3:.2f}GB VRAM")
        
        # Tối ưu cho CUDA
        cuda_config = {
            "use_cuda": True,
            "device": "cuda:0",
            "use_amp": True,  # Sử dụng automatic mixed precision
            "batch_size": 32,  # Batch size lớn hơn cho GPU
            "max_seq_length": 256,
        }
        
        with open(os.path.join(EMBEDDINGS_DIR, "hardware_config.json"), "w") as f:
            json.dump(cuda_config, f, indent=2)
        
        logger.info("Đã lưu cấu hình tối ưu cho GPU")
    else:
        # Tối ưu cho CPU
        cpu_config = {
            "use_cuda": False,
            "device": "cpu",
            "use_amp": False,
            "batch_size": 8,  # Batch size nhỏ hơn cho CPU
            "max_seq_length": 128,
            "num_threads": min(os.cpu_count(), 4),  # Sử dụng tối đa 4 luồng
        }
        
        with open(os.path.join(EMBEDDINGS_DIR, "hardware_config.json"), "w") as f:
            json.dump(cpu_config, f, indent=2)
        
        logger.info(f"Đã lưu cấu hình tối ưu cho CPU với {min(os.cpu_count(), 4)} luồng")
    
    return True

def optimize_cache():
    """Tối ưu hóa cấu hình bộ nhớ cache cho embeddings"""
    cache_config = {
        "enable_cache": True,
        "cache_dir": CACHE_DIR,
        "max_cache_size": 10000,  # Lưu tối đa 10000 mục
        "cache_expiration": 86400,  # Hết hạn sau 24 giờ (86400 giây)
        "background_indexing": True,  # Đánh chỉ mục ngầm
    }
    
    with open(os.path.join(EMBEDDINGS_DIR, "cache_config.json"), "w") as f:
        json.dump(cache_config, f, indent=2)
    
    logger.info(f"Đã lưu cấu hình bộ nhớ cache cho embeddings")
    return True

def test_embeddings(model_name="paraphrase-multilingual-MiniLM-L12-v2"):
    """Kiểm tra mô hình embeddings"""
    if not os.path.exists(CONFIG_FILE):
        logger.error(f"Không tìm thấy cấu hình mô hình tại {CONFIG_FILE}")
        return False
    
    try:
        # Đọc cấu hình
        with open(CONFIG_FILE, "r") as f:
            config = json.load(f)
        
        # Tải mô hình
        model = SentenceTransformer(config["model_name"], cache_folder=CACHE_DIR)
        
        # Kiểm tra với một số câu mẫu
        sentences = [
            "Xin chào, đây là một câu tiếng Việt",
            "Hello, this is an English sentence"
        ]
        
        logger.info(f"Tạo embedding cho {len(sentences)} câu...")
        embeddings = model.encode(sentences)
        
        logger.info(f"Đã tạo embeddings thành công với kích thước: {embeddings.shape}")
        
        # Tính độ tương đồng cosine
        from sklearn.metrics.pairwise import cosine_similarity
        similarity = cosine_similarity([embeddings[0]], [embeddings[1]])[0][0]
        
        logger.info(f"Độ tương đồng cosine giữa câu tiếng Việt và tiếng Anh: {similarity:.4f}")
        return True
    
    except Exception as e:
        logger.error(f"Lỗi khi kiểm tra mô hình embeddings: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Tối ưu hóa mô hình embeddings cho hệ thống dịch thuật")
    parser.add_argument(
        "--setup", 
        action="store_true",
        help="Thiết lập thư mục embeddings"
    )
    parser.add_argument(
        "--download", 
        action="store_true",
        help="Tải mô hình embeddings"
    )
    parser.add_argument(
        "--model",
        choices=list(AVAILABLE_MODELS.keys()),
        default="paraphrase-multilingual-MiniLM-L12-v2",
        help="Chọn mô hình embeddings để tải"
    )
    parser.add_argument(
        "--optimize-hardware", 
        action="store_true",
        help="Tối ưu hóa cấu hình cho phần cứng"
    )
    parser.add_argument(
        "--optimize-cache", 
        action="store_true",
        help="Tối ưu hóa cấu hình bộ nhớ cache"
    )
    parser.add_argument(
        "--test", 
        action="store_true",
        help="Kiểm tra mô hình embeddings"
    )
    parser.add_argument(
        "--all", 
        action="store_true",
        help="Thực hiện tất cả các bước"
    )
    
    args = parser.parse_args()
    
    # Nếu không có tham số, hiển thị trợ giúp
    if len(sys.argv) == 1:
        parser.print_help()
        return
    
    # Thực hiện các bước tối ưu hóa
    if args.all or args.setup:
        setup_embeddings_dir()
    
    if args.all or args.download:
        download_model(args.model)
    
    if args.all or args.optimize_hardware:
        optimize_for_hardware()
    
    if args.all or args.optimize_cache:
        optimize_cache()
    
    if args.all or args.test:
        test_embeddings(args.model)
    
    logger.info("=== Hoàn tất tối ưu hóa dịch vụ embeddings! ===")

if __name__ == "__main__":
    main() 
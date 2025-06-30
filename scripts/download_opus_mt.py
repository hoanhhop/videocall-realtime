#!/usr/bin/env python
# -*- coding: utf-8 -*-
# download_opus_mt.py - Script tải mô hình OPUS-MT cho hệ thống dịch thuật video call

import os
import argparse
import torch
from transformers import MarianMTModel, MarianTokenizer
import logging
import shutil
from pathlib import Path

# Cấu hình logging
logging.basicConfig(
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

# Find project root directory
def find_project_root():
    """Find the project root directory"""
    current_path = os.path.dirname(os.path.abspath(__file__))
    parent_path = os.path.dirname(current_path)
    if os.path.exists(os.path.join(parent_path, "server")):
        return parent_path
    return os.path.abspath(os.path.join(parent_path, ".."))

# Thư mục gốc cho các mô hình
PROJECT_ROOT = find_project_root()
MODELS_DIR = os.path.join(PROJECT_ROOT, "server", "models", "opus_mt")

# Cấu hình mô hình
MODELS_CONFIG = {
    "vi-en": {
        "model_name": "Helsinki-NLP/opus-mt-vi-en",
        "output_dir": os.path.join(MODELS_DIR, "opus-mt-vi-en"),
    },
    "en-vi": {
        "model_name": "Helsinki-NLP/opus-mt-en-vi",
        "output_dir": os.path.join(MODELS_DIR, "opus-mt-en-vi"),
    },
}

def download_model(model_key, force=False):
    """Tải mô hình OPUS-MT và lưu vào thư mục cục bộ"""
    config = MODELS_CONFIG.get(model_key)
    if not config:
        logger.error(f"Không tìm thấy cấu hình cho mô hình {model_key}")
        return False

    model_name = config["model_name"]
    output_dir = config["output_dir"]
    
    # Kiểm tra xem mô hình đã tồn tại chưa
    if os.path.exists(output_dir) and not force:
        if os.path.exists(os.path.join(output_dir, "pytorch_model.bin")):
            logger.info(f"Mô hình {model_key} đã tồn tại tại {output_dir}")
            return True
        else:
            logger.warning(f"Thư mục {output_dir} tồn tại nhưng không có model. Sẽ tải lại.")
            
    # Tạo thư mục nếu chưa tồn tại
    os.makedirs(output_dir, exist_ok=True)
    
    try:
        logger.info(f"Đang tải tokenizer cho {model_name}...")
        tokenizer = MarianTokenizer.from_pretrained(model_name)
        
        logger.info(f"Đang tải model {model_name}...")
        model = MarianMTModel.from_pretrained(model_name)
        
        # Lưu mô hình và tokenizer vào thư mục cục bộ
        logger.info(f"Lưu mô hình và tokenizer vào {output_dir}...")
        tokenizer.save_pretrained(output_dir)
        model.save_pretrained(output_dir)
        
        logger.info(f"Tải và lưu mô hình {model_key} thành công!")
        return True
    
    except Exception as e:
        logger.error(f"Lỗi khi tải mô hình {model_key}: {e}")
        # Xóa thư mục nếu tải thất bại để tránh trạng thái không nhất quán
        if os.path.exists(output_dir):
            shutil.rmtree(output_dir)
        return False

def optimize_model(model_key):
    """Tối ưu hóa mô hình để giảm kích thước và tăng tốc độ"""
    config = MODELS_CONFIG.get(model_key)
    if not config:
        logger.error(f"Không tìm thấy cấu hình cho mô hình {model_key}")
        return False

    output_dir = config["output_dir"]
    
    if not os.path.exists(os.path.join(output_dir, "pytorch_model.bin")):
        logger.error(f"Không tìm thấy mô hình tại {output_dir}")
        return False
    
    try:
        logger.info(f"Đang tối ưu hóa mô hình {model_key}...")
        
        # Tải mô hình từ thư mục cục bộ
        model = MarianMTModel.from_pretrained(output_dir)
        
        # Chuyển sang half precision để giảm kích thước và tăng tốc độ
        model = model.half()  # FP16
        
        # Lưu lại mô hình đã tối ưu hóa
        model.save_pretrained(output_dir)
        
        logger.info(f"Tối ưu hóa mô hình {model_key} thành công!")
        return True
    
    except Exception as e:
        logger.error(f"Lỗi khi tối ưu hóa mô hình {model_key}: {e}")
        return False

def test_model(model_key, test_text=None):
    """Kiểm tra mô hình bằng cách dịch một câu thử nghiệm"""
    config = MODELS_CONFIG.get(model_key)
    if not config:
        logger.error(f"Không tìm thấy cấu hình cho mô hình {model_key}")
        return
    
    output_dir = config["output_dir"]
    
    if not os.path.exists(os.path.join(output_dir, "pytorch_model.bin")):
        logger.error(f"Không tìm thấy mô hình tại {output_dir}")
        return
    
    # Mặc định test text dựa trên cặp ngôn ngữ
    if test_text is None:
        if model_key == "vi-en":
            test_text = "Xin chào, tôi đang kiểm tra hệ thống dịch thuật."
        else:
            test_text = "Hello, I am testing the translation system."
    
    try:
        logger.info(f"Kiểm tra mô hình {model_key} với câu: '{test_text}'")
        
        # Tải tokenizer và model
        tokenizer = MarianTokenizer.from_pretrained(output_dir)
        model = MarianMTModel.from_pretrained(output_dir)
        
        # Đưa về CPU nếu không có GPU
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        model = model.to(device)
        
        # Dịch
        batch = tokenizer([test_text], return_tensors="pt").to(device)
        gen = model.generate(**batch)
        translated = tokenizer.batch_decode(gen, skip_special_tokens=True)
        
        logger.info(f"Kết quả dịch: '{translated[0]}'")
        
    except Exception as e:
        logger.error(f"Lỗi khi kiểm tra mô hình {model_key}: {e}")

def main():
    parser = argparse.ArgumentParser(description="Tải mô hình OPUS-MT cho hệ thống dịch thuật")
    parser.add_argument(
        "--models", 
        choices=["all", "vi-en", "en-vi"], 
        default="all",
        help="Chọn (các) mô hình để tải. Mặc định: tất cả"
    )
    parser.add_argument(
        "--force", 
        action="store_true",
        help="Tải lại mô hình ngay cả khi đã tồn tại"
    )
    parser.add_argument(
        "--optimize", 
        action="store_true",
        help="Tối ưu hóa mô hình sau khi tải"
    )
    parser.add_argument(
        "--test", 
        action="store_true",
        help="Kiểm tra mô hình sau khi tải"
    )
    parser.add_argument(
        "--test-text",
        type=str,
        help="Văn bản để kiểm tra dịch thuật"
    )
    
    args = parser.parse_args()
    
    # Tạo thư mục gốc nếu chưa tồn tại
    os.makedirs(MODELS_DIR, exist_ok=True)
    
    # Xác định mô hình cần tải
    models_to_process = list(MODELS_CONFIG.keys()) if args.models == "all" else [args.models]
    
    for model_key in models_to_process:
        logger.info(f"=== Xử lý mô hình {model_key} ===")
        
        # Tải mô hình
        success = download_model(model_key, args.force)
        
        if success:
            # Tối ưu hóa mô hình nếu có yêu cầu
            if args.optimize:
                optimize_model(model_key)
            
            # Kiểm tra mô hình nếu có yêu cầu
            if args.test:
                test_model(model_key, args.test_text)
        
        logger.info("")  # Dòng trống giữa các mô hình
    
    logger.info("=== Hoàn tất! ===")

if __name__ == "__main__":
    main() 
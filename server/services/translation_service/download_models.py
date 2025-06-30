#!/usr/bin/env python
# -*- coding: utf-8 -*-
# download_models.py - Script để tải các mô hình OPUS-MT từ Hugging Face

import os
import argparse
import logging
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def download_model(model_name, output_dir):
    """Tải mô hình từ Hugging Face Hub và lưu vào thư mục cục bộ"""
    logger.info(f"Bắt đầu tải mô hình {model_name} vào {output_dir}")
    
    try:
        # Tạo thư mục nếu chưa tồn tại
        os.makedirs(output_dir, exist_ok=True)
        
        # Tải tokenizer
        logger.info(f"Đang tải tokenizer cho {model_name}...")
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        tokenizer.save_pretrained(output_dir)
        logger.info(f"Đã lưu tokenizer vào {output_dir}")
        
        # Tải model
        logger.info(f"Đang tải model cho {model_name}...")
        model = AutoModelForSeq2SeqLM.from_pretrained(model_name)
        model.save_pretrained(output_dir)
        logger.info(f"Đã lưu model vào {output_dir}")
        
        return True
    except Exception as e:
        logger.error(f"Lỗi khi tải mô hình {model_name}: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Tải mô hình OPUS-MT từ Hugging Face Hub")
    parser.add_argument("--base-dir", type=str, default="../../models/opus_mt", 
                      help="Thư mục cơ sở để lưu các mô hình. Mặc định: ../../models/opus_mt")
    parser.add_argument("--vi-en", action="store_true", 
                      help="Tải mô hình Việt-Anh (Helsinki-NLP/opus-mt-vi-en)")
    parser.add_argument("--en-vi", action="store_true", 
                      help="Tải mô hình Anh-Việt (Helsinki-NLP/opus-mt-en-vi)")
    parser.add_argument("--all", action="store_true", 
                      help="Tải tất cả các mô hình")
    
    args = parser.parse_args()
    
    if not args.vi_en and not args.en_vi and not args.all:
        logger.error("Vui lòng chỉ định ít nhất một mô hình để tải (--vi-en, --en-vi, hoặc --all)")
        parser.print_help()
        return
    
    base_dir = os.path.abspath(args.base_dir)
    os.makedirs(base_dir, exist_ok=True)
    
    models_to_download = []
    
    if args.vi_en or args.all:
        models_to_download.append(("Helsinki-NLP/opus-mt-vi-en", os.path.join(base_dir, "vi_en_model")))
    
    if args.en_vi or args.all:
        models_to_download.append(("Helsinki-NLP/opus-mt-en-vi", os.path.join(base_dir, "en_vi_model")))
    
    success_count = 0
    
    for model_name, output_dir in models_to_download:
        logger.info(f"=== Tải mô hình {model_name} ===")
        if download_model(model_name, output_dir):
            success_count += 1
    
    logger.info(f"=== Tổng kết ===")
    logger.info(f"Đã tải thành công {success_count}/{len(models_to_download)} mô hình")
    
    if success_count == len(models_to_download):
        logger.info(f"✅ Tất cả mô hình đã được tải thành công vào {base_dir}")
    else:
        logger.warning(f"⚠️ Một số mô hình không được tải thành công. Kiểm tra log để biết thêm chi tiết.")

if __name__ == "__main__":
    main() 
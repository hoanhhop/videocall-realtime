#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Script chuyển đổi mô hình OPUS-MT sang định dạng CTranslate2

import os
import sys
import logging
import argparse
import shutil
from pathlib import Path
import datetime  # Thêm import datetime

# Cấu hình logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def find_project_root():
    """Tìm thư mục gốc của dự án"""
    current_path = os.path.dirname(os.path.abspath(__file__))
    if os.path.exists(os.path.join(current_path, "server")):
        return current_path
    return os.path.abspath(os.path.join(current_path, ".."))

def convert_opus_to_ct2(model_path, output_path, quantization="float16", device="cuda", force=True):
    """Chuyển đổi mô hình OPUS-MT sang định dạng CTranslate2 với tối ưu hiệu năng"""
    try:
        import ctranslate2
        from transformers import MarianMTModel, MarianTokenizer
        import torch
        from ctranslate2.converters import TransformersConverter
        
        logger.info(f"Bắt đầu chuyển đổi mô hình từ {model_path} sang CTranslate2")
        
        # Kiểm tra xem thư mục đầu ra đã tồn tại chưa
        if os.path.exists(output_path):
            logger.info(f"Thư mục đầu ra {output_path} đã tồn tại, đang xóa...")
            shutil.rmtree(output_path)
        
        # Kiểm tra xem model_path có tồn tại không
        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Không tìm thấy thư mục mô hình tại {model_path}")
        
        # Tải mô hình từ thư mục
        logger.info(f"Đang tải mô hình từ {model_path}")
        
        # Kiểm tra xem có phải mô hình Marian không
        config_file = os.path.join(model_path, "config.json")
        if not os.path.exists(config_file):
            raise FileNotFoundError(f"Không tìm thấy file config.json tại {model_path}")
        
        # Tải model và tokenizer
        tokenizer = MarianTokenizer.from_pretrained(model_path)
        model = MarianMTModel.from_pretrained(model_path)
        
        # Thực hiện chuyển đổi
        logger.info(f"Bắt đầu chuyển đổi sang CTranslate2 với quantization={quantization}")
          # Sử dụng các tham số tối ưu hiệu năng cho CTranslate2
        converter = TransformersConverter(model_path)
        converter.convert(
            output_path, 
            quantization=quantization,
            force=force,
            compute_type="default" if device == "cpu" else "auto",
            # Thêm tham số tối ưu
            use_fast_tokenizer=True,
            revision=None,
            low_cpu_mem_usage=True
        )
        
        logger.info(f"Chuyển đổi thành công! Mô hình CTranslate2 đã được lưu tại {output_path}")
        
        # Tạo file README để mô tả mô hình - Sửa lỗi mã hóa
        try:
            with open(os.path.join(output_path, "README.txt"), "w", encoding="utf-8") as f:
                f.write(f"Mo hinh CTranslate2 duoc chuyen doi tu {model_path}\n")
                f.write(f"Quantization: {quantization}\n")
                f.write(f"Ngay chuyen doi: {datetime.datetime.now()}\n")
        except Exception as e:
            logger.warning(f"Không thể tạo file README: {e}")
            # Tạo file README với nội dung ASCII
            with open(os.path.join(output_path, "README.txt"), "w") as f:
                f.write(f"Model CTranslate2 converted from {model_path}\n")
                f.write(f"Quantization: {quantization}\n")
                f.write(f"Conversion date: {datetime.datetime.now()}\n")
        
        return True
        
    except ImportError as e:
        logger.error(f"Thiếu thư viện cần thiết: {e}")
        logger.error("Vui lòng cài đặt ctranslate2 và transformers: pip install ctranslate2 transformers torch")
        return False
    except Exception as e:
        logger.error(f"Lỗi khi chuyển đổi mô hình: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return False

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Chuyển đổi mô hình OPUS-MT sang định dạng CTranslate2")
    parser.add_argument("--model_path", type=str, required=True,
                        help="Đường dẫn đến thư mục mô hình OPUS-MT")
    parser.add_argument("--output_path", type=str, 
                        default=None,
                        help="Đường dẫn đến thư mục đầu ra (mặc định là model_path-ct2)")
    parser.add_argument("--quantization", type=str, default="int8",
                        choices=["int8", "int16", "float16", "float"],
                        help="Loại quantization sử dụng (int8, int16, float16, float)")
    parser.add_argument("--device", type=str, default="cuda",
                        choices=["cuda", "cpu"],
                        help="Thiết bị sử dụng để chuyển đổi (cuda hoặc cpu)")
    
    args = parser.parse_args()
    
    # Nếu output_path không được chỉ định, sử dụng model_path-ct2
    if args.output_path is None:
        model_name = os.path.basename(args.model_path)
        args.output_path = os.path.join(os.path.dirname(args.model_path), f"{model_name}-ct2")
    
    # Chuyển đổi mô hình
    success = convert_opus_to_ct2(args.model_path, args.output_path, args.quantization, args.device)
    
    if success:
        logger.info("Chuyển đổi thành công!")
        sys.exit(0)
    else:
        logger.error("Chuyển đổi thất bại!")
        sys.exit(1)
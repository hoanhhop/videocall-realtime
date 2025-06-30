#!/usr/bin/env python
"""
Script tải các mô hình cần thiết từ Hugging Face
"""

import os
import sys
import shutil
import argparse
from pathlib import Path
import subprocess
import logging

# Cấu hình logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Danh sách mô hình
MODELS = {
    "phowhisper": {
        "id": "nguyenvulebinh/phowhisper-base-ct2",
        "path": "models/phowhisper/PhoWhisper-base-ct2",
    },
    "opus_mt_en_vi": {
        "id": "Helsinki-NLP/opus-mt-en-vi",
        "path": "models/opus_mt/en_vi_model",
    },
    "opus_mt_vi_en": {
        "id": "Helsinki-NLP/opus-mt-vi-en",
        "path": "models/opus_mt/vi_en_model",
    },
}

def setup_environment():
    """Kiểm tra và cài đặt các gói cần thiết"""
    try:
        import huggingface_hub
    except ImportError:
        logger.info("Cài đặt huggingface_hub...")
        subprocess.check_call([sys.executable, "-m", "pip", "install", "huggingface_hub"])
        import huggingface_hub
    return huggingface_hub

def download_model(model_id, output_path, force=False):
    """Tải mô hình từ Hugging Face"""
    import huggingface_hub
    
    output_path = Path(output_path)
    
    # Kiểm tra nếu mô hình đã tồn tại
    if output_path.exists() and not force:
        logger.info(f"Mô hình đã tồn tại tại {output_path}. Bỏ qua tải xuống.")
        return True
    
    # Tạo thư mục nếu chưa tồn tại
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    try:
        logger.info(f"Đang tải mô hình {model_id}...")
        huggingface_hub.snapshot_download(
            repo_id=model_id,
            local_dir=output_path,
            local_dir_use_symlinks=False
        )
        logger.info(f"Đã tải xong mô hình {model_id} vào {output_path}")
        return True
    except Exception as e:
        logger.error(f"Lỗi khi tải mô hình {model_id}: {str(e)}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Tải mô hình từ Hugging Face")
    parser.add_argument("--force", action="store_true", help="Tải lại mô hình ngay cả khi đã tồn tại")
    parser.add_argument("--models", nargs="+", choices=MODELS.keys(), help="Chỉ định mô hình cần tải")
    args = parser.parse_args()
    
    # Cài đặt môi trường
    huggingface_hub = setup_environment()
    
    # Xác định mô hình cần tải
    models_to_download = args.models if args.models else MODELS.keys()
    
    # Tải mô hình
    success_count = 0
    for model_name in models_to_download:
        model_info = MODELS[model_name]
        logger.info(f"Chuẩn bị tải mô hình {model_name} ({model_info['id']})...")
        if download_model(model_info["id"], model_info["path"], args.force):
            success_count += 1
    
    logger.info(f"Đã tải thành công {success_count}/{len(models_to_download)} mô hình.")

if __name__ == "__main__":
    main() 
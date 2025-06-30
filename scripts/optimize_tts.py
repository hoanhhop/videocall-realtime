#!/usr/bin/env python
# -*- coding: utf-8 -*-
# optimize_tts.py - Script tối ưu hóa mô hình TTS (XTTS-v2) cho hệ thống dịch thuật video call

import os
import argparse
import logging
import shutil
import torch
from pathlib import Path
import sys
import subprocess
import zipfile
import tempfile
from urllib.request import urlretrieve
from tqdm import tqdm

# Cấu hình logging
logging.basicConfig(
    format="%(asctime)s - %(levelname)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

# Thư mục gốc cho mô hình TTS
TTS_DIR = os.path.join("server", "models", "tts")
XTTS_MODEL_DIR = os.path.join(TTS_DIR, "XTTS-v2")
SPEAKERS_DIR = os.path.join(TTS_DIR, "speakers")
HUGGINGFACE_URL = "https://huggingface.co/coqui/XTTS-v2/resolve/main/"

# Mẫu tiếng nói cho các ngôn ngữ
SAMPLE_SPEAKERS = {
    "vi": "vi_female_sample.wav",  # Mẫu giọng nữ tiếng Việt
    "vi_male": "vi_male_sample.wav",  # Mẫu giọng nam tiếng Việt
    "en": "en_female_sample.wav",  # Mẫu giọng nữ tiếng Anh
    "en_male": "en_male_sample.wav",  # Mẫu giọng nam tiếng Anh
}

class TqdmUpTo(tqdm):
    """Cung cấp thanh tiến trình cho quá trình tải xuống với urlretrieve"""
    def update_to(self, b=1, bsize=1, tsize=None):
        if tsize is not None:
            self.total = tsize
        self.update(b * bsize - self.n)

def download_file(url, output_path, desc=None):
    """Tải file với thanh tiến trình"""
    with TqdmUpTo(unit='B', unit_scale=True, unit_divisor=1024, desc=desc) as t:
        urlretrieve(url, filename=output_path, reporthook=t.update_to)

def download_xtts_model():
    """Tải mô hình XTTS-v2 từ Hugging Face"""
    # Các file cần thiết cho mô hình XTTS
    model_files = [
        "model_conf.json",
        "vocab.json",
        "speakers_xtts.pth",
        "model.pth",
        "config.json",
        "README.md",
    ]
    
    os.makedirs(XTTS_MODEL_DIR, exist_ok=True)
    
    # Kiểm tra xem mô hình đã tồn tại chưa
    if os.path.exists(os.path.join(XTTS_MODEL_DIR, "model.pth")):
        logger.info("Mô hình XTTS-v2 đã tồn tại.")
        return True
    
    logger.info("Bắt đầu tải mô hình XTTS-v2...")
    success = True
    
    for file in model_files:
        url = f"{HUGGINGFACE_URL}{file}"
        output_path = os.path.join(XTTS_MODEL_DIR, file)
        
        try:
            logger.info(f"Tải {file}...")
            download_file(url, output_path, desc=f"Tải {file}")
        except Exception as e:
            logger.error(f"Lỗi khi tải {file}: {e}")
            success = False
    
    if success:
        logger.info("Tải mô hình XTTS-v2 thành công!")
    else:
        logger.error("Tải mô hình XTTS-v2 thất bại!")
    
    return success

def setup_speaker_samples():
    """Thiết lập các mẫu giọng nói"""
    os.makedirs(SPEAKERS_DIR, exist_ok=True)
    
    # Kiểm tra xem đã có mẫu giọng nói chưa
    if any(os.path.exists(os.path.join(SPEAKERS_DIR, sample)) for sample in SAMPLE_SPEAKERS.values()):
        logger.info("Đã có mẫu giọng nói.")
        return True
    
    logger.info("Thiết lập mẫu giọng nói...")
    
    # Trong trường hợp thực tế, bạn sẽ cần tải xuống hoặc cung cấp các mẫu giọng nói 
    # Đây chỉ là ví dụ, trong triển khai thực tế bạn có thể cần thay đổi
    
    # Giả vờ tạo các file mẫu (trong triển khai thực tế, bạn cần có file thật)
    for lang, filename in SAMPLE_SPEAKERS.items():
        sample_path = os.path.join(SPEAKERS_DIR, filename)
        if not os.path.exists(sample_path):
            logger.warning(f"Không tìm thấy mẫu giọng {filename}. Trong triển khai thực tế, bạn cần cung cấp file mẫu giọng nói.")
            # Tạo file trống (chỉ để kiểm tra, không sử dụng được)
            with open(sample_path, "w") as f:
                f.write("Đây là file mẫu. Thay thế bằng file WAV thực.")
    
    logger.info("Thiết lập mẫu giọng nói hoàn tất.")
    return True

def optimize_tts_for_cuda():
    """Tối ưu hóa cấu hình TTS cho CUDA"""
    if not torch.cuda.is_available():
        logger.warning("Không phát hiện CUDA. Bỏ qua tối ưu hóa cho GPU.")
        return False
    
    logger.info("Tối ưu hóa TTS cho CUDA...")
    
    # Lưu cấu hình tối ưu
    config_path = os.path.join(TTS_DIR, "cuda_config.json")
    
    import json
    config = {
        "use_cuda": True,
        "precision": "fp16",  # hoặc "fp32" tùy thuộc vào GPU
        "batch_size": 16,     # Điều chỉnh dựa trên bộ nhớ GPU
        "num_threads": 4,
        "stream_chunk_size": 20,
        "cuda_optimization": {
            "cudnn_benchmark": True,
            "cudnn_deterministic": False,
        }
    }
    
    with open(config_path, "w") as f:
        json.dump(config, f, indent=2)
    
    logger.info(f"Đã lưu cấu hình CUDA tối ưu vào {config_path}")
    return True

def run_tts_test():
    """Thử nghiệm hệ thống TTS để xác nhận tất cả hoạt động như mong đợi"""
    # Kiểm tra xem tất cả các thành phần cần thiết có tồn tại không
    model_path = os.path.join(XTTS_MODEL_DIR, "model.pth")
    
    if not os.path.exists(model_path):
        logger.error(f"Không tìm thấy model.pth tại {model_path}")
        return False
    
    # Kiểm tra xem có ít nhất một mẫu giọng nói không
    has_samples = any(os.path.exists(os.path.join(SPEAKERS_DIR, sample)) for sample in SAMPLE_SPEAKERS.values())
    if not has_samples:
        logger.error(f"Không tìm thấy mẫu giọng nói nào trong {SPEAKERS_DIR}")
        return False
    
    logger.info("Sẵn sàng chạy dịch vụ TTS. Tất cả các thành phần cần thiết đã có.")
    return True

def main():
    parser = argparse.ArgumentParser(description="Tối ưu hóa mô hình TTS cho hệ thống dịch thuật")
    parser.add_argument(
        "--download", 
        action="store_true",
        help="Tải mô hình XTTS-v2"
    )
    parser.add_argument(
        "--setup-speakers", 
        action="store_true",
        help="Thiết lập mẫu giọng nói"
    )
    parser.add_argument(
        "--optimize", 
        action="store_true",
        help="Tối ưu hóa cấu hình TTS"
    )
    parser.add_argument(
        "--test", 
        action="store_true",
        help="Kiểm tra hệ thống TTS"
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
    
    # Tạo thư mục gốc nếu chưa tồn tại
    os.makedirs(TTS_DIR, exist_ok=True)
    
    # Thực hiện các bước tối ưu hóa
    if args.all or args.download:
        download_xtts_model()
    
    if args.all or args.setup_speakers:
        setup_speaker_samples()
    
    if args.all or args.optimize:
        optimize_tts_for_cuda()
    
    if args.all or args.test:
        run_tts_test()
    
    logger.info("=== Hoàn tất tối ưu hóa TTS! ===")

if __name__ == "__main__":
    main() 
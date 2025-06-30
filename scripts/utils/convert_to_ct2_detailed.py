import os
import sys
import traceback
import logging
import time
import torch
from pathlib import Path
from transformers import WhisperForConditionalGeneration, WhisperProcessor

# Cấu hình logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Đường dẫn thư mục
MODEL_DIR = os.path.join("server", "models", "phowhisper")
SOURCE_DIR = os.path.join(MODEL_DIR, "PhoWhisper-medium")
CT2_TARGET_DIR = os.path.join(MODEL_DIR, "PhoWhisper-medium-ct2")

def check_directory(path):
    """Kiểm tra và tạo thư mục nếu chưa tồn tại"""
    if not os.path.exists(path):
        os.makedirs(path, exist_ok=True)
        logger.info(f"Đã tạo thư mục: {path}")
    return os.path.exists(path)

def check_model_files(path):
    """Kiểm tra xem các file cần thiết cho mô hình có tồn tại không"""
    required_files = ["config.json", "pytorch_model.bin"]
    missing_files = [f for f in required_files if not os.path.exists(os.path.join(path, f))]
    
    if missing_files:
        logger.error(f"Thiếu các file cần thiết: {', '.join(missing_files)}")
        return False
    
    logger.info(f"Đã tìm thấy tất cả các file cần thiết trong {path}")
    return True

def validate_model(path):
    """Thử tải mô hình từ thư mục để kiểm tra tính hợp lệ"""
    try:
        logger.info(f"Đang thử tải mô hình từ {path} để kiểm tra...")
        start_time = time.time()
        processor = WhisperProcessor.from_pretrained(path)
        model = WhisperForConditionalGeneration.from_pretrained(path)
        end_time = time.time()
        logger.info(f"Mô hình đã được tải thành công trong {end_time - start_time:.2f} giây.")
        return True
    except Exception as e:
        logger.error(f"Không thể tải mô hình: {e}")
        logger.error(traceback.format_exc())
        return False

def convert_to_ct2():
    """Chuyển đổi mô hình sang định dạng CTranslate2"""
    logger.info("Bắt đầu quá trình chuyển đổi...")
    
    # Kiểm tra thư mục nguồn
    if not check_directory(SOURCE_DIR):
        logger.error(f"Thư mục nguồn {SOURCE_DIR} không tồn tại")
        return False
    
    # Kiểm tra các file mô hình
    if not check_model_files(SOURCE_DIR):
        return False
    
    # Kiểm tra tính hợp lệ của mô hình
    if not validate_model(SOURCE_DIR):
        return False
    
    # Kiểm tra thư mục đích
    check_directory(CT2_TARGET_DIR)
    
    # Cài đặt ctranslate2 nếu chưa có
    try:
        import ctranslate2
        import ctranslate2.converters.transformers
        logger.info("Đã tìm thấy thư viện ctranslate2")
    except ImportError:
        logger.error("Thư viện ctranslate2 chưa được cài đặt. Đang cài đặt...")
        try:
            import pip
            pip.main(['install', 'ctranslate2'])
            import ctranslate2
            import ctranslate2.converters.transformers
            logger.info("Đã cài đặt ctranslate2 thành công")
        except Exception as e:
            logger.error(f"Không thể cài đặt ctranslate2: {e}")
            logger.error(traceback.format_exc())
            return False
    
    # Chuyển đổi mô hình
    try:
        logger.info(f"Bắt đầu chuyển đổi mô hình từ {SOURCE_DIR} sang CT2...")
        start_time = time.time()
        
        # Xác định quantization
        quantization = "int8"
        logger.info(f"Sử dụng quantization: {quantization}")
        
        # Gọi hàm chuyển đổi
        logger.info(f"Chuyển đổi mô hình sang định dạng CT2 tại {CT2_TARGET_DIR}...")
        
        ctranslate2.converters.transformers.convert_model(
            model_name_or_path=SOURCE_DIR,
            output_dir=CT2_TARGET_DIR,
            quantization=quantization,
            force=True
        )
        
        end_time = time.time()
        logger.info(f"Chuyển đổi mô hình thành công trong {end_time - start_time:.2f} giây")
        return True
    except Exception as e:
        logger.error(f"Lỗi khi chuyển đổi mô hình: {e}")
        logger.error(traceback.format_exc())
        return False

def verify_ct2_model():
    """Kiểm tra xem mô hình CT2 đã được tạo đúng chưa"""
    required_files = ["model.bin", "config.json", "vocabulary.txt"]
    missing_files = [f for f in required_files if not os.path.exists(os.path.join(CT2_TARGET_DIR, f))]
    
    if missing_files:
        logger.error(f"Thiếu các file cần thiết trong mô hình CT2: {', '.join(missing_files)}")
        return False
    
    logger.info(f"Đã tìm thấy tất cả các file cần thiết trong mô hình CT2 tại {CT2_TARGET_DIR}")
    return True

if __name__ == "__main__":
    logger.info("===== BẮT ĐẦU QUÁ TRÌNH CHUYỂN ĐỔI MÔ HÌNH =====")
    
    # Hiển thị thông tin hệ thống
    logger.info(f"Python version: {sys.version}")
    logger.info(f"PyTorch version: {torch.__version__}")
    logger.info(f"CUDA available: {torch.cuda.is_available()}")
    if torch.cuda.is_available():
        logger.info(f"CUDA version: {torch.version.cuda}")
        logger.info(f"GPU: {torch.cuda.get_device_name(0)}")
    
    # Hiển thị đường dẫn
    logger.info(f"Thư mục nguồn: {os.path.abspath(SOURCE_DIR)}")
    logger.info(f"Thư mục đích: {os.path.abspath(CT2_TARGET_DIR)}")
    
    # Bắt đầu chuyển đổi
    success = convert_to_ct2()
    
    if success:
        if verify_ct2_model():
            logger.info("===== CHUYỂN ĐỔI MÔ HÌNH THÀNH CÔNG =====")
            logger.info(f"Mô hình CTranslate2 đã được lưu tại: {os.path.abspath(CT2_TARGET_DIR)}")
        else:
            logger.error("Chuyển đổi không hoàn thành - mô hình CT2 không hợp lệ")
    else:
        logger.error("===== CHUYỂN ĐỔI MÔ HÌNH THẤT BẠI =====") 
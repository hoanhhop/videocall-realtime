#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Kiểm tra xem các mô hình ONNX đã được tạo ra chưa và có thể load được không.
"""

import os
import sys
import logging
from pathlib import Path

# Cấu hình logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def check_onnx_models(onnx_dir):
    """Kiểm tra xem các file ONNX đã được tạo ra chưa và có thể load được không."""
    onnx_path = Path(onnx_dir)
    
    if not onnx_path.exists():
        logger.error(f"Thư mục {onnx_dir} không tồn tại!")
        return False
    
    # Kiểm tra các file ONNX có tồn tại không
    expected_files = ["encoder.onnx", "decoder.onnx", "vocoder.onnx"]
    existing_files = [f.name for f in onnx_path.glob("*.onnx")]
    
    logger.info(f"Các file ONNX đã tìm thấy: {existing_files}")
    
    # Kiểm tra kích thước file
    for file in existing_files:
        file_path = onnx_path / file
        size_mb = file_path.stat().st_size / (1024 * 1024)
        logger.info(f"File {file}: {size_mb:.2f} MB")
    
    # Thử load các file ONNX
    try:
        import onnx
        import onnxruntime as ort
        
        for file in existing_files:
            file_path = str(onnx_path / file)
            logger.info(f"Đang kiểm tra file {file}...")
            
            # Load ONNX model
            try:
                onnx_model = onnx.load(file_path)
                onnx.checker.check_model(onnx_model)
                logger.info(f"✅ File {file} hợp lệ theo định dạng ONNX")
                
                # Thử khởi tạo một phiên ONNX Runtime
                try:
                    sess = ort.InferenceSession(file_path)
                    logger.info(f"✅ File {file} có thể load được với ONNX Runtime")
                    
                    # In thông tin input và output
                    inputs = sess.get_inputs()
                    outputs = sess.get_outputs()
                    logger.info(f"  - Inputs: {[x.name for x in inputs]}")
                    logger.info(f"  - Input shapes: {[x.shape for x in inputs]}")
                    logger.info(f"  - Outputs: {[x.name for x in outputs]}")
                    
                except Exception as e:
                    logger.error(f"❌ Không thể khởi tạo ONNX Runtime với {file}: {e}")
                    
            except Exception as e:
                logger.error(f"❌ File {file} không hợp lệ: {e}")
                
    except ImportError:
        logger.warning("Không tìm thấy thư viện onnx hoặc onnxruntime. Cài đặt chúng để kiểm tra đầy đủ.")
        logger.warning("pip install onnx onnxruntime")
        return False
        
    # Kết luận
    missing_files = set(expected_files) - set(existing_files)
    if missing_files:
        logger.warning(f"Chưa tạo được các file: {missing_files}")
        return False
    else:
        logger.info("✅ Tất cả các file ONNX cần thiết đã được tạo!")
        return True

def main():
    # Đường dẫn mặc định cho ONNX models
    default_onnx_dir = os.path.join("server", "models", "tts", "XTTS-v2", "onnx")
    
    # Kiểm tra các file ONNX
    logger.info("===== KIỂM TRA CÁC FILE ONNX =====")
    check_onnx_models(default_onnx_dir)

if __name__ == "__main__":
    main()

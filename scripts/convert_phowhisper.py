#!/usr/bin/env python
# -*- coding: utf-8 -*-
# convert_phowhisper.py - Chuyển đổi mô hình PhoWhisper sang CTranslate2

import os
import argparse
import ctranslate2
from ctranslate2.converters import WhisperConverter

def main():
    parser = argparse.ArgumentParser(description="Chuyển đổi mô hình PhoWhisper sang định dạng CTranslate2")
    parser.add_argument("--source", type=str, required=True, help="Đường dẫn đến mô hình PhoWhisper-base gốc (thư mục chứa pytorch_model.bin, config.json, etc.)")
    parser.add_argument("--output", type=str, required=True, help="Đường dẫn đầu ra cho mô hình CTranslate2")
    parser.add_argument("--quantization", type=str, default="int8_float16", 
                        choices=["float32", "float16", "int16", "int8", "int8_float16"],
                        help="Định dạng lượng tử hóa (quantization) cho mô hình (mặc định: int8_float16 cho CPU)")
    parser.add_argument("--force", action="store_true", help="Ghi đè thư mục đầu ra nếu đã tồn tại")
    args = parser.parse_args()

    source_path = args.source
    output_path = args.output
    quantization = args.quantization

    print(f"Đường dẫn mô hình nguồn: {os.path.abspath(source_path)}")
    print(f"Đường dẫn thư mục đầu ra: {os.path.abspath(output_path)}")
    print(f"Định dạng lượng tử hóa: {quantization}")

    if not os.path.isdir(source_path):
        print(f"Lỗi: Đường dẫn mô hình nguồn '{source_path}' không phải là một thư mục hoặc không tồn tại.")
        return
    
    # Tạo đối tượng converter
    converter = WhisperConverter(source_path)

    print(f"Bắt đầu chuyển đổi sang định dạng CTranslate2 với định dạng {quantization}...")
    
    # Thực hiện chuyển đổi
    # Hàm convert yêu cầu output_dir, quantization, và các tham số khác tùy chọn
    converter.convert(
        output_dir=output_path,
        quantization=quantization,
        force=args.force # Thêm force từ argument
    )

    print(f"Đã chuyển đổi mô hình thành công! Kết quả nằm trong {output_path}")
    print("Kiểm tra các file trong thư mục đầu ra:")
    for item in os.listdir(output_path):
        print(f"- {item}")

if __name__ == "__main__":
    main() 
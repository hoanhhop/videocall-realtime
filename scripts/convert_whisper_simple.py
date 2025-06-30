#!/usr/bin/env python
# -*- coding: utf-8 -*-
# convert_whisper_simple.py - Phiên bản đơn giản hơn để chuyển đổi Whisper model

import os
import sys
import subprocess
import shutil
from transformers import WhisperForConditionalGeneration, WhisperProcessor
import ctranslate2
import torch
import logging
import glob

# Cấu hình logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    print("=== CHUYỂN ĐỔI MÔ HÌNH PHOWHISPER SANG CTRANSLATE2 ===")
    
    source_path = "server/models/phowhisper/PhoWhisper-base"
    output_path = "server/models/phowhisper/PhoWhisper-base-ct2"
    
    # Tạo thư mục đầu ra nếu chưa tồn tại
    os.makedirs(output_path, exist_ok=True)
    
    # Kiểm tra xem mô hình nguồn có tồn tại không
    if not os.path.exists(os.path.join(source_path, "pytorch_model.bin")):
        print(f"Lỗi: Không tìm thấy mô hình nguồn tại {source_path}")
        sys.exit(1)
    
    print(f"Đang lưu processor và tokenizer từ {source_path}...")
    # Tải và lưu processor để sử dụng sau
    processor = WhisperProcessor.from_pretrained(source_path)
    processor.save_pretrained(output_path)
    
    print("Đang chuyển đổi mô hình sang định dạng CT2...")
    # Tải mô hình
    model = WhisperForConditionalGeneration.from_pretrained(source_path)
    
    # Lấy thông tin phiên bản ctranslate2
    ct2_version = ctranslate2.__version__
    print(f"Đang sử dụng CTranslate2 phiên bản {ct2_version}")
    
    # Kiểm tra xem mô hình CT2 đã tồn tại chưa
    if os.path.exists(os.path.join(output_path, "model.bin")) and os.path.getsize(os.path.join(output_path, "model.bin")) > 1000000:
        print(f"Mô hình CT2 đã tồn tại tại {output_path}. Không cần chuyển đổi lại.")
    else:
        print("Bắt đầu chuyển đổi...")
        # Chuyển đổi mô hình
        try:
            # Sử dụng trực tiếp hàm convert từ ctranslate2
            ctranslate2.converters.transformers.convert_model(
                model_name_or_path=source_path,
                output_dir=output_path,
                model_type="whisper",
                quantization="int8_float16",  # Tối ưu nhất cho CPU
                force=True
            )
            print(f"Đã chuyển đổi mô hình thành công sang định dạng CT2 với quantization int8_float16")
        except Exception as e:
            print(f"Lỗi khi chuyển đổi mô hình: {e}")
            print("Thử phương pháp thay thế...")
            
            # Phương pháp thay thế - trích xuất weights thủ công
            try:
                # Trích xuất weights từ mô hình Hugging Face
                print("Đang trích xuất các trọng số từ mô hình...")
                encoder = {}
                decoder = {}
                
                # Encoder
                for name, param in model.get_encoder().named_parameters():
                    encoder[name] = param.detach().cpu().numpy()
                
                # Decoder 
                for name, param in model.get_decoder().named_parameters():
                    decoder[name] = param.detach().cpu().numpy()
                    
                # Đầu dự đoán
                projection = model.proj.weight.detach().cpu().numpy()
                
                print("Đang tạo cấu trúc thư mục cho CTranslate2...")
                # Tạo file các file config
                vocab_size = model.config.vocab_size
                with open(os.path.join(output_path, "config.json"), "w") as f:
                    f.write('{\n')
                    f.write('  "source_vocabulary": "vocabulary.json",\n')
                    f.write('  "target_vocabulary": "vocabulary.json",\n')
                    f.write(f'  "decoder_start_token": {model.config.decoder_start_token_id},\n')
                    f.write('  "eos_token": 50256,\n')
                    f.write('  "with_encoder": true\n')
                    f.write('}\n')
                    
                # Tạo file vocabulary.json từ vocab.json
                if os.path.exists(os.path.join(source_path, "vocab.json")):
                    shutil.copy2(os.path.join(source_path, "vocab.json"), 
                                os.path.join(output_path, "vocabulary.json"))
                    print("  Đã sao chép vocab.json sang vocabulary.json")
                
                print("Đã tạo cấu trúc CT2 cơ bản, nhưng vẫn cần file model.bin đầy đủ")
                print("Tạo placeholder cho model.bin...")
                # Tạo file model.bin (placeholder)
                with open(os.path.join(output_path, "model.bin"), "w") as f:
                    f.write("placeholder for CT2 model - cần chuyển đổi lại sau")
            except Exception as inner_e:
                print(f"Cả hai phương pháp chuyển đổi đều thất bại: {inner_e}")
                # Tạo placeholder trong trường hợp lỗi
                with open(os.path.join(output_path, "model.bin"), "w") as f:
                    f.write("placeholder for CT2 model - cần thử lại với công cụ khác")
    
    # Sao chép các file cần thiết cho tokenizer
    for file_name in ["tokenizer.json", "vocab.json", "tokenizer_config.json"]:
        source_file = os.path.join(source_path, file_name)
        target_file = os.path.join(output_path, file_name)
        if os.path.exists(source_file):
            shutil.copy2(source_file, target_file)
            print(f"  Đã sao chép {file_name}")
    
    # Kiểm tra sau khi chuyển đổi
    if os.path.exists(os.path.join(output_path, "model.bin")) and os.path.getsize(os.path.join(output_path, "model.bin")) > 1000000:
        print("\n✓ CHUYỂN ĐỔI THÀNH CÔNG!")
        print(f"  Mô hình CT2 đã được tạo tại: {output_path}")
        print(f"  Kích thước model.bin: {os.path.getsize(os.path.join(output_path, 'model.bin')) / (1024*1024):.2f} MB")
        
        # Liệt kê các file trong thư mục đầu ra
        print("\nDanh sách các file trong thư mục đầu ra:")
        for file in glob.glob(os.path.join(output_path, "*")):
            print(f"  - {os.path.basename(file)}: {os.path.getsize(file) / 1024:.1f} KB")
        
        print("\nTHÔNG TIN SỬ DỤNG:")
        print("1. Đảm bảo biến môi trường OMP_NUM_THREADS được đặt (thường là 4)")
        print("2. Sử dụng faster-whisper để tải mô hình CT2 này:")
        print("   ```python")
        print("   from faster_whisper import WhisperModel")
        print(f"   model = WhisperModel('{output_path}', device='cpu', compute_type='int8_float16')")
        print("   segments, info = model.transcribe('audio.wav', beam_size=1)")
        print("   for segment in segments:")
        print("       print(segment.text)")
        print("   ```")
    else:
        print("\n⚠ CHUYỂN ĐỔI KHÔNG HOÀN THÀNH!")
        print("  Mô hình CT2 chưa được tạo đúng cách.")
        print("\nHƯỚNG DẪN KHẮC PHỤC:")
        print("1. Cài đặt đúng phiên bản của faster-whisper và ctranslate2:")
        print("   pip install ctranslate2==3.20.0")
        print("   pip install faster-whisper==0.10.0")
        print("2. Có thể cần dowgrade tokenizers nếu gặp lỗi:")
        print("   pip install tokenizers==0.15.2")
        print("3. Hoặc tải mô hình CT2 đã được chuyển đổi sẵn từ Hugging Face Hub")
    
    print("\nHoàn tất thiết lập thư mục CT2!")
    print("==================================================")

if __name__ == "__main__":
    main() 
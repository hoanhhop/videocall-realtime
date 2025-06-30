#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script chuyển đổi mô hình XTTS từ PyTorch sang ONNX
Được thiết kế để chạy với Python >= 3.7 và có output rõ ràng
"""

import os
import sys
import time
import torch
import traceback
import argparse
from pathlib import Path

LOG_FILE_PATH = os.path.join(os.path.dirname(__file__), "conversion_debug_log.txt")

# Clear log file at the beginning of the script execution
if os.path.exists(LOG_FILE_PATH):
    os.remove(LOG_FILE_PATH)

def log(message):
    """In ra log với timestamp và ghi vào file"""
    timestamp = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime())
    log_message = f"[{timestamp}] {message}"
    print(log_message)
    sys.stdout.flush() # Đảm bảo log được ghi ngay lập tức ra console
    try:
        with open(LOG_FILE_PATH, "a", encoding="utf-8") as f:
            f.write(log_message + "\n")
    except Exception as e:
        print(f"Error writing to log file: {e}")

def export_module_to_onnx(module, dummy_inputs, output_path, input_names, output_names, dynamic_axes=None):
    """
    Export một module PyTorch sang định dạng ONNX
    """
    try:
        log(f"Bắt đầu export module sang {output_path}...")
        
        # Đặt module vào chế độ eval
        module.eval()
        
        # Export sang ONNX
        torch.onnx.export(
            module,
            dummy_inputs,
            output_path,
            export_params=True,
            opset_version=14,
            do_constant_folding=True,
            input_names=input_names,
            output_names=output_names,
            dynamic_axes=dynamic_axes or {},
        )
        
        # Kiểm tra kích thước file đã tạo
        file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
        log(f"✅ Đã export thành công: {output_path} ({file_size_mb:.2f} MB)")
        return True
    
    except Exception as e:
        log(f"❌ Lỗi khi export {output_path}: {e}")
        log(traceback.format_exc())
        return False

def main():
    # Phân tích tham số dòng lệnh
    parser = argparse.ArgumentParser(description="Chuyển đổi mô hình XTTS sang ONNX")
    parser.add_argument("--model_path", type=str, default="server/models/tts/XTTS-v2", 
                      help="Thư mục chứa mô hình XTTS")
    parser.add_argument("--output_path", type=str, default="server/models/tts/XTTS-v2/onnx", 
                      help="Thư mục lưu file ONNX")
    parser.add_argument("--device", type=str, choices=["cpu", "cuda"], default="cpu", 
                      help="Thiết bị sử dụng để export (cpu hoặc cuda)")
    args = parser.parse_args()

    model_dir = args.model_path
    output_dir = args.output_path
    device = args.device

    log(f"===== BẮT ĐẦU CHUYỂN ĐỔI MÔ HÌNH XTTS SANG ONNX =====")
    log(f"Thư mục mô hình đầu vào: {model_dir}")
    log(f"Thư mục xuất ONNX: {output_dir}")
    log(f"Thiết bị sử dụng: {device}")
    
    # Kiểm tra CUDA nếu được yêu cầu
    if device == "cuda" and not torch.cuda.is_available():
        log("⚠️ CUDA được yêu cầu nhưng không khả dụng! Chuyển sang CPU.")
        device = "cpu"
    
    # Tạo thư mục output nếu chưa tồn tại
    os.makedirs(output_dir, exist_ok=True)
    
    # Kiểm tra các file cần thiết
    model_pth = os.path.join(model_dir, "model.pth")
    config_json = os.path.join(model_dir, "config.json")
    vocab_json = os.path.join(model_dir, "vocab.json") # Added line

    if not os.path.exists(model_pth):
        log(f"❌ Không tìm thấy file model.pth trong {model_dir}")
        sys.exit(1)
        
    if not os.path.exists(config_json):
        log(f"❌ Không tìm thấy file config.json trong {model_dir}")
        sys.exit(1)

    if not os.path.exists(vocab_json): # Added block
        log(f"❌ Không tìm thấy file vocab.json trong {model_dir}")
        sys.exit(1)
    
    # Tải thư viện TTS
    try:
        log("Tải các thư viện TTS cần thiết...")
        from TTS.tts.configs.xtts_config import XttsConfig
        from TTS.tts.models.xtts import Xtts
        log("✅ Đã tải thư viện TTS thành công!")
    except ImportError as e:
        log(f"❌ Không thể tải thư viện TTS: {e}")
        log("Hãy cài đặt TTS bằng lệnh: pip install TTS")
        sys.exit(1)
        
    # Tải model XTTS
    try:
        log("Tải cấu hình mô hình...")
        config = XttsConfig()
        config.load_json(config_json)
        config.vocab_path = vocab_json  # explicit vocab path

        log("Khởi tạo mô hình từ cấu hình...")
        model = Xtts.init_from_config(config)

        log("Tải checkpoint mô hình...")
        # Use positional args: (config, checkpoint_dir, checkpoint_path, vocab_path, eval)
        model.load_checkpoint(config, model_dir, model_pth, vocab_json, True)

        # Move model to device and set eval
        model.to(device)
        model.eval()
        log("✅ Đã tải mô hình XTTS thành công!")
    except Exception as e:
        log(f"❌ Không thể tải mô hình XTTS: {e}")
        log(traceback.format_exc())
        sys.exit(1)

    # Export encoder
    log("\n----- EXPORT ENCODER -----")
    try:
        encoder = model.encoder
        log(f"Tạo dummy input cho encoder...")
        
        # Dummy inputs cho encoder
        dummy_text = torch.randint(0, 100, (1, 100)).to(device)
        dummy_lang = torch.tensor([0]).to(device)
        dummy_cond_latent = torch.randn(1, 1024).to(device)
        
        log(f"Input shapes: text={dummy_text.shape}, lang={dummy_lang.shape}, cond_latent={dummy_cond_latent.shape}")
        
        # Đường dẫn file output
        encoder_out_path = os.path.join(output_dir, "encoder.onnx")
        
        # Export encoder
        export_result = export_module_to_onnx(
            encoder,
            (dummy_text, dummy_lang, dummy_cond_latent),
            encoder_out_path,
            input_names=["text", "lang", "cond_latent"],
            output_names=["encoder_out"],
            dynamic_axes={"text": {1: "seq_len"}}
        )
        
        if not export_result:
            log("⚠️ Chuyển đổi encoder không thành công!")
    except Exception as e:
        log(f"❌ Lỗi khi export encoder: {e}")
        log(traceback.format_exc())

    # Export decoder
    log("\n----- EXPORT DECODER -----")
    try:
        decoder = model.decoder
        log(f"Tạo dummy input cho decoder...")
        
        # Dummy inputs cho decoder
        dummy_encoder_out = torch.randn(1, 100, 1024).to(device)
        dummy_speaker = torch.randn(1, 512).to(device)
        
        log(f"Input shapes: encoder_out={dummy_encoder_out.shape}, speaker_embedding={dummy_speaker.shape}")
        
        # Đường dẫn file output
        decoder_out_path = os.path.join(output_dir, "decoder.onnx")
        
        # Export decoder
        export_result = export_module_to_onnx(
            decoder,
            (dummy_encoder_out, dummy_speaker),
            decoder_out_path,
            input_names=["encoder_out", "speaker_embedding"],
            output_names=["decoder_out"],
            dynamic_axes={"encoder_out": {1: "seq_len"}}
        )
        
        if not export_result:
            log("⚠️ Chuyển đổi decoder không thành công!")
    except Exception as e:
        log(f"❌ Lỗi khi export decoder: {e}")
        log(traceback.format_exc())

    # Export vocoder
    log("\n----- EXPORT VOCODER -----")
    try:
        if hasattr(model, "vocoder") and model.vocoder is not None:
            vocoder = model.vocoder
            log(f"Tạo dummy input cho vocoder...")
            
            # Dummy input cho vocoder
            dummy_mel = torch.randn(1, 80, 200).to(device)
            
            log(f"Input shape: mel={dummy_mel.shape}")
            
            # Đường dẫn file output
            vocoder_out_path = os.path.join(output_dir, "vocoder.onnx")
            
            # Export vocoder
            export_result = export_module_to_onnx(
                vocoder,
                (dummy_mel,),
                vocoder_out_path,
                input_names=["mel"],
                output_names=["audio"],
                dynamic_axes={"mel": {2: "n_frames"}}
            )
            
            if not export_result:
                log("⚠️ Chuyển đổi vocoder không thành công!")
        else:
            log("⚠️ Mô hình không có vocoder hoặc vocoder=None.")
    except Exception as e:
        log(f"❌ Lỗi khi export vocoder: {e}")
        log(traceback.format_exc())

    # Kiểm tra kết quả
    log("\n----- KẾT QUẢ CHUYỂN ĐỔI -----")
    onnx_files = [f for f in os.listdir(output_dir) if f.endswith(".onnx")]
    
    if onnx_files:
        log(f"✅ Đã tạo thành công {len(onnx_files)} file ONNX:")
        for file in onnx_files:
            file_path = os.path.join(output_dir, file)
            size_mb = os.path.getsize(file_path) / (1024 * 1024)
            log(f"  - {file}: {size_mb:.2f} MB")
    else:
        log("❌ Không có file ONNX nào được tạo!")

    log("\n===== KẾT THÚC QUÁ TRÌNH EXPORT XTTS SANG ONNX =====")

if __name__ == "__main__":
    main()

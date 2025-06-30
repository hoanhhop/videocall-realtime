#!/usr/bin/env python
"""
Script cầu nối để chạy convert_xtts_to_onnx.py
"""

import sys
import os
import subprocess

def main():
    script_path = os.path.join("scripts", "utils", "convert_xtts_to_onnx.py")
    model_path = os.path.join("server", "models", "tts", "XTTS-v2")
    output_path = os.path.join("server", "models", "tts", "XTTS-v2", "onnx")
    device = "cpu"
    
    # Kiểm tra thư mục tồn tại
    if not os.path.exists(model_path):
        print(f"Lỗi: Không tìm thấy thư mục mô hình: {model_path}")
        sys.exit(1)
        
    # Tạo thư mục output nếu chưa tồn tại
    os.makedirs(output_path, exist_ok=True)
    
    # Kiểm tra các file cần thiết
    model_pth = os.path.join(model_path, "model.pth")
    config_json = os.path.join(model_path, "config.json")
    
    if not os.path.exists(model_pth):
        print(f"Lỗi: Không tìm thấy file model.pth trong {model_path}")
        sys.exit(1)
        
    if not os.path.exists(config_json):
        print(f"Lỗi: Không tìm thấy file config.json trong {model_path}")
        sys.exit(1)
    
    # Kiểm tra thư viện
    try:
        import torch
        print(f"PyTorch version: {torch.__version__}")
    except ImportError:
        print("Lỗi: Không tìm thấy thư viện PyTorch. Hãy cài đặt PyTorch trước.")
        sys.exit(1)
    
    try:
        import TTS
        print(f"Coqui TTS version: {TTS.__version__ if hasattr(TTS, '__version__') else 'unknown'}")
    except ImportError:
        print("Lỗi: Không tìm thấy thư viện Coqui TTS. Hãy cài đặt TTS trước.")
        sys.exit(1)
        
    print(f"Bắt đầu chuyển đổi mô hình từ {model_path} sang ONNX tại {output_path}...")
    
    # Thực hiện chuyển đổi thủ công thay vì gọi script
    try:
        from TTS.tts.configs.xtts_config import XttsConfig
        from TTS.tts.models.xtts import Xtts
        import torch
        
        print("Tải mô hình...")
        config = XttsConfig()
        config.load_json(config_json)
        model = Xtts.init_from_config(config)
        model.load_checkpoint(config, checkpoint_path=model_pth, eval=True)
        model.to(device)
        model.eval()
        print("Đã tải mô hình thành công!")
        
        # Export encoder
        try:
            print("Đang chuyển đổi encoder sang ONNX...")
            encoder = model.encoder
            dummy_text = torch.randint(0, 100, (1, 100)).to(device)
            dummy_lang = torch.tensor([0]).to(device)
            dummy_cond_latent = torch.randn(1, 1024).to(device)
            
            encoder_out_path = os.path.join(output_path, "encoder.onnx")
            torch.onnx.export(
                encoder,
                (dummy_text, dummy_lang, dummy_cond_latent),
                encoder_out_path,
                export_params=True,
                opset_version=14,
                do_constant_folding=True,
                input_names=["text", "lang", "cond_latent"],
                output_names=["encoder_out"],
                dynamic_axes={"text": {1: "seq_len"}}
            )
            print(f"✅ Đã export encoder thành công: {encoder_out_path}")
        except Exception as e:
            print(f"❌ Không thể export encoder: {e}")
            
        # Export decoder
        try:
            print("Đang chuyển đổi decoder sang ONNX...")
            decoder = model.decoder
            dummy_encoder_out = torch.randn(1, 100, 1024).to(device)
            dummy_speaker = torch.randn(1, 512).to(device)
            
            decoder_out_path = os.path.join(output_path, "decoder.onnx")
            torch.onnx.export(
                decoder,
                (dummy_encoder_out, dummy_speaker),
                decoder_out_path,
                export_params=True,
                opset_version=14,
                do_constant_folding=True,
                input_names=["encoder_out", "speaker_embedding"],
                output_names=["decoder_out"],
                dynamic_axes={"encoder_out": {1: "seq_len"}}
            )
            print(f"✅ Đã export decoder thành công: {decoder_out_path}")
        except Exception as e:
            print(f"❌ Không thể export decoder: {e}")
            
        # Export vocoder
        try:
            if hasattr(model, "vocoder") and model.vocoder is not None:
                print("Đang chuyển đổi vocoder sang ONNX...")
                vocoder = model.vocoder
                dummy_mel = torch.randn(1, 80, 200).to(device)
                
                vocoder_out_path = os.path.join(output_path, "vocoder.onnx")
                torch.onnx.export(
                    vocoder,
                    (dummy_mel,),
                    vocoder_out_path,
                    export_params=True,
                    opset_version=14,
                    do_constant_folding=True,
                    input_names=["mel"],
                    output_names=["audio"],
                    dynamic_axes={"mel": {2: "n_frames"}}
                )
                print(f"✅ Đã export vocoder thành công: {vocoder_out_path}")
            else:
                print("Model không có vocoder hoặc vocoder=None.")
        except Exception as e:
            print(f"❌ Không thể export vocoder: {e}")
            
        print("==== KẾT THÚC QUÁ TRÌNH EXPORT XTTS SANG ONNX ====")
        
    except Exception as e:
        print(f"Lỗi trong quá trình chuyển đổi: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()

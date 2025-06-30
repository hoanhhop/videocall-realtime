#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Script đơn giản để chuyển đổi encoder từ mô hình XTTS sang ONNX
"""

import os
import torch

# Thư mục chứa model
model_dir = os.path.join("server", "models", "tts", "XTTS-v2")
output_dir = os.path.join(model_dir, "onnx")

# Đảm bảo thư mục output tồn tại
os.makedirs(output_dir, exist_ok=True)

# Đường dẫn đến model và config
model_pth = os.path.join(model_dir, "model.pth")
config_json = os.path.join(model_dir, "config.json")

print("Bắt đầu chuyển đổi encoder...")
print(f"Model path: {model_pth}")
print(f"Config path: {config_json}")

# Kiểm tra các file cần thiết
if not os.path.exists(model_pth):
    print(f"Không tìm thấy file model.pth tại {model_pth}")
    exit(1)
if not os.path.exists(config_json):
    print(f"Không tìm thấy file config.json tại {config_json}")
    exit(1)

# Tải model
try:
    from TTS.tts.configs.xtts_config import XttsConfig
    from TTS.tts.models.xtts import Xtts
    
    print("Đang tải cấu hình mô hình...")
    config = XttsConfig()
    config.load_json(config_json)
    
    print("Đang khởi tạo mô hình...")
    model = Xtts.init_from_config(config)
    
    print("Đang tải checkpoint...")
    model.load_checkpoint(config, checkpoint_path=model_pth, eval=True)
    model.to("cpu")
    model.eval()
    print("Đã tải mô hình thành công!")
except Exception as e:
    print(f"Lỗi khi tải model: {e}")
    import traceback
    traceback.print_exc()
    exit(1)

# Chỉ export encoder
try:
    print("\nĐang chuyển đổi encoder sang ONNX...")
    encoder = model.encoder
    
    # Tạo dummy input cho encoder
    dummy_text = torch.randint(0, 100, (1, 100))  # (batch_size, seq_len)
    dummy_lang = torch.tensor([0])  # language ID
    dummy_cond_latent = torch.randn(1, 1024)  # (batch_size, latent_dim)
    
    # Đường dẫn file xuất
    encoder_output = os.path.join(output_dir, "encoder.onnx")
    
    # Export encoder sang ONNX
    torch.onnx.export(
        encoder,
        (dummy_text, dummy_lang, dummy_cond_latent),
        encoder_output,
        export_params=True,
        opset_version=14,
        do_constant_folding=True,
        input_names=["text", "lang", "cond_latent"],
        output_names=["encoder_out"],
        dynamic_axes={"text": {1: "seq_len"}}
    )
    
    # Kiểm tra file đã được tạo
    if os.path.exists(encoder_output):
        size_mb = os.path.getsize(encoder_output) / (1024 * 1024)
        print(f"✅ Đã export encoder thành công: {encoder_output} ({size_mb:.2f} MB)")
    else:
        print(f"❌ Không thể tạo file {encoder_output}")
except Exception as e:
    print(f"Lỗi khi chuyển đổi encoder: {e}")
    import traceback
    traceback.print_exc()

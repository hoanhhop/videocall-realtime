#!/usr/bin/env python
# -*- coding: utf-8 -*-

import sys
import os

print("=== Kiểm tra môi trường Python ===")
print(f"Python version: {sys.version}")
print(f"Python executable: {sys.executable}")

print("\n=== Kiểm tra thư viện ===")
try:
    import torch
    print(f"PyTorch version: {torch.__version__}")
    print(f"CUDA available: {torch.cuda.is_available()}")
except ImportError:
    print("PyTorch not installed")

try:
    import TTS
    print(f"TTS version: {TTS.__version__ if hasattr(TTS, '__version__') else 'unknown'}")
except ImportError:
    print("TTS not installed")

try:
    import onnx
    print(f"ONNX version: {onnx.__version__}")
except ImportError:
    print("ONNX not installed")

print("\n=== Kiểm tra mô hình ===")
model_dir = os.path.join("server", "models", "tts", "XTTS-v2")
if os.path.exists(model_dir):
    print(f"Model directory {model_dir} exists")
    
    # Kiểm tra các file cần thiết
    model_pth = os.path.join(model_dir, "model.pth")
    config_json = os.path.join(model_dir, "config.json")
    
    if os.path.exists(model_pth):
        size_mb = os.path.getsize(model_pth) / (1024 * 1024)
        print(f"model.pth exists: {size_mb:.2f} MB")
    else:
        print("model.pth does not exist")
        
    if os.path.exists(config_json):
        size_kb = os.path.getsize(config_json) / 1024
        print(f"config.json exists: {size_kb:.2f} KB")
    else:
        print("config.json does not exist")
else:
    print(f"Model directory {model_dir} does not exist")

print("\n=== Kiểm tra thư mục ONNX ===")
onnx_dir = os.path.join(model_dir, "onnx")
if os.path.exists(onnx_dir):
    print(f"ONNX directory {onnx_dir} exists")
    
    # Liệt kê các file
    files = os.listdir(onnx_dir)
    print(f"Files in {onnx_dir}: {files}")
else:
    print(f"ONNX directory {onnx_dir} does not exist")

print("\nHoàn thành kiểm tra.")

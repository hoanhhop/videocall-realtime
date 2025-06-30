#!/usr/bin/env python
"""
Script để kiểm tra thư viện TTS và mô hình
"""

import os
import sys

def check_tts():
    try:
        import TTS
        print(f"TTS found: {TTS.__version__ if hasattr(TTS, '__version__') else 'version unknown'}")
        return True
    except ImportError:
        print("TTS not found")
        return False

def check_onnx():
    try:
        import onnx
        print(f"ONNX found: {onnx.__version__}")
        return True
    except ImportError:
        print("ONNX not found")
        return False

def check_model_files():
    model_dir = os.path.join("server", "models", "tts", "XTTS-v2")
    print(f"Checking model files in {model_dir}")
    
    if not os.path.exists(model_dir):
        print(f"Model directory {model_dir} does not exist!")
        return False
        
    files_to_check = ["model.pth", "config.json", "vocab.json"]
    missing_files = []
    
    for file in files_to_check:
        file_path = os.path.join(model_dir, file)
        if os.path.exists(file_path):
            size_mb = os.path.getsize(file_path) / (1024 * 1024)
            print(f"✓ Found {file} ({size_mb:.2f} MB)")
        else:
            print(f"✗ Missing {file}")
            missing_files.append(file)
            
    if missing_files:
        print(f"Missing required files: {', '.join(missing_files)}")
        return False
    
    # Check ONNX output directory
    onnx_dir = os.path.join(model_dir, "onnx")
    print(f"\nChecking ONNX files in {onnx_dir}")
    
    if not os.path.exists(onnx_dir):
        print(f"ONNX directory {onnx_dir} does not exist!")
        return False
        
    onnx_files = [f for f in os.listdir(onnx_dir) if f.endswith(".onnx")]
    if onnx_files:
        for file in onnx_files:
            file_path = os.path.join(onnx_dir, file)
            size_mb = os.path.getsize(file_path) / (1024 * 1024)
            print(f"✓ Found {file} ({size_mb:.2f} MB)")
    else:
        print("No .onnx files found in output directory")
    
    return True

def check_venv():
    """Check if we're running in a venv and which Python interpreter is being used"""
    in_venv = sys.prefix != sys.base_prefix
    print(f"Running in virtual environment: {in_venv}")
    print(f"Python executable: {sys.executable}")
    print(f"Python version: {sys.version}")
    
    return in_venv

if __name__ == "__main__":
    print("=== Checking environment and libraries ===")
    check_venv()
    print()
    
    print("=== Checking required libraries ===")
    has_tts = check_tts()
    has_onnx = check_onnx()
    print()
    
    print("=== Checking model files ===")
    check_model_files()
    
    if not has_tts:
        print("\nWarning: TTS library not found. Installation instructions:")
        print("1. Activate virtual environment (if using one)")
        print("2. Run: pip install TTS")
        
    if not has_onnx:
        print("\nWarning: ONNX library not found. Installation instructions:")
        print("1. Activate virtual environment (if using one)")
        print("2. Run: pip install onnx onnxruntime")

"""
Script đơn giản để chuyển đổi mô hình XTTS sang ONNX
"""

import os
import sys
import torch

def convert_model():
    # Thư mục chứa mô hình và thư mục xuất
    model_path = os.path.join("server", "models", "tts", "XTTS-v2")
    output_path = os.path.join("server", "models", "tts", "XTTS-v2", "onnx")
    
    # Đảm bảo thư mục xuất tồn tại
    os.makedirs(output_path, exist_ok=True)
    
    # Kiểm tra các file cần thiết
    model_file = os.path.join(model_path, "model.pth")
    config_file = os.path.join(model_path, "config.json")
    
    if not os.path.exists(model_file):
        print(f"Error: Model file not found at {model_file}")
        return False
        
    if not os.path.exists(config_file):
        print(f"Error: Config file not found at {config_file}")
        return False
    
    # Tải các thư viện cần thiết
    try:
        from TTS.tts.configs.xtts_config import XttsConfig
        from TTS.tts.models.xtts import Xtts
    except ImportError as e:
        print(f"Error importing TTS libraries: {e}")
        print("Please make sure TTS is installed: pip install TTS")
        return False
    
    # Tải mô hình
    try:
        print("Loading model configuration...")
        config = XttsConfig()
        config.load_json(config_file)
        
        print("Initializing model...")
        model = Xtts.init_from_config(config)
        
        print("Loading model checkpoint...")
        model.load_checkpoint(config, checkpoint_path=model_file, eval=True)
        model.to("cpu")
        model.eval()
        print("Model loaded successfully!")
    except Exception as e:
        print(f"Error loading model: {e}")
        return False
    
    # Chuyển đổi encoder sang ONNX
    try:
        print("\nExporting encoder to ONNX...")
        
        # Tạo dummy inputs cho encoder
        encoder = model.encoder
        dummy_text = torch.randint(0, 100, (1, 100))
        dummy_lang = torch.tensor([0])
        dummy_cond_latent = torch.randn(1, 1024)
        
        # Đường dẫn file xuất
        encoder_output_path = os.path.join(output_path, "encoder.onnx")
        
        # Export encoder sang ONNX
        torch.onnx.export(
            encoder,
            (dummy_text, dummy_lang, dummy_cond_latent),
            encoder_output_path,
            export_params=True,
            opset_version=14,
            do_constant_folding=True,
            input_names=["text", "lang", "cond_latent"],
            output_names=["encoder_out"],
            dynamic_axes={"text": {1: "seq_len"}}
        )
        
        print(f"Encoder exported to {encoder_output_path}")
    except Exception as e:
        print(f"Error exporting encoder: {e}")
    
    # Chuyển đổi decoder sang ONNX
    try:
        print("\nExporting decoder to ONNX...")
        
        # Tạo dummy inputs cho decoder
        decoder = model.decoder
        dummy_encoder_out = torch.randn(1, 100, 1024)
        dummy_speaker = torch.randn(1, 512)
        
        # Đường dẫn file xuất
        decoder_output_path = os.path.join(output_path, "decoder.onnx")
        
        # Export decoder sang ONNX
        torch.onnx.export(
            decoder,
            (dummy_encoder_out, dummy_speaker),
            decoder_output_path,
            export_params=True,
            opset_version=14,
            do_constant_folding=True,
            input_names=["encoder_out", "speaker_embedding"],
            output_names=["decoder_out"],
            dynamic_axes={"encoder_out": {1: "seq_len"}}
        )
        
        print(f"Decoder exported to {decoder_output_path}")
    except Exception as e:
        print(f"Error exporting decoder: {e}")
    
    # Chuyển đổi vocoder sang ONNX (nếu có)
    if hasattr(model, "vocoder") and model.vocoder is not None:
        try:
            print("\nExporting vocoder to ONNX...")
            
            # Tạo dummy inputs cho vocoder
            vocoder = model.vocoder
            dummy_mel = torch.randn(1, 80, 200)
            
            # Đường dẫn file xuất
            vocoder_output_path = os.path.join(output_path, "vocoder.onnx")
            
            # Export vocoder sang ONNX
            torch.onnx.export(
                vocoder,
                (dummy_mel,),
                vocoder_output_path,
                export_params=True,
                opset_version=14,
                do_constant_folding=True,
                input_names=["mel"],
                output_names=["audio"],
                dynamic_axes={"mel": {2: "n_frames"}}
            )
            
            print(f"Vocoder exported to {vocoder_output_path}")
        except Exception as e:
            print(f"Error exporting vocoder: {e}")
    else:
        print("\nNo vocoder found in model")
    
    # Kiểm tra kết quả
    onnx_files = [f for f in os.listdir(output_path) if f.endswith(".onnx")]
    if onnx_files:
        print(f"\nSuccessfully created {len(onnx_files)} ONNX files:")
        for file in onnx_files:
            file_path = os.path.join(output_path, file)
            size_mb = os.path.getsize(file_path) / (1024 * 1024)
            print(f"- {file}: {size_mb:.2f} MB")
        return True
    else:
        print("\nNo ONNX files were created!")
        return False
    
if __name__ == "__main__":
    print("===== Starting conversion of XTTS model to ONNX =====")
    success = convert_model()
    if success:
        print("\n✅ Conversion completed successfully!")
    else:
        print("\n❌ Conversion failed!")

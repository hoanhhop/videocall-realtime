#!/usr/bin/env python
# -*- coding: utf-8 -*-
# run_tts_optimized.py - Optimized Flask HTTP Service for XTTSv2 without ONNX

import os
import io
import time
import tempfile
import logging
import torch
import numpy as np
from TTS.tts.configs.xtts_config import XttsConfig
from TTS.tts.models.xtts import Xtts
from TTS.utils.generic_utils import get_user_data_dir
from TTS.utils.manage import ModelManager
from pydub import AudioSegment
import soundfile as sf
from flask import Flask, request, jsonify, send_file
from concurrent.futures import ThreadPoolExecutor
import re
import queue

# Cấu hình logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# --- Cấu hình Thiết bị & Model ---
MODEL_PATH = os.environ.get("MODEL_PATH", "/app/models/XTTS-v2")
USE_CUDA = os.environ.get("USE_CUDA", "true").lower() == "true"
SAMPLE_RATE = int(os.environ.get("SAMPLE_RATE", "24000"))
SPEAKER_WAV_PATH = os.environ.get("SPEAKER_WAV_PATH", "/app/models/speakers")
CHUNK_SIZE = int(os.environ.get("CHUNK_SIZE", "150"))
MAX_WORKERS = int(os.environ.get("MAX_WORKERS", "4"))

# --- Biến toàn cục ---
model = None
device = None
executor = ThreadPoolExecutor(max_workers=MAX_WORKERS)
tts_queue = queue.Queue(maxsize=10)
speaker_embeddings_cache = {}

def load_model():
    """Tải mô hình XTTS với tối ưu PyTorch"""
    global model, device
    
    # Thiết lập device
    if torch.cuda.is_available() and USE_CUDA:
        device = torch.device("cuda")
        logger.info(f"Sử dụng GPU: {torch.cuda.get_device_name(0)}")
        # Tối ưu GPU
        torch.backends.cudnn.benchmark = True
        torch.backends.cudnn.deterministic = False
    else:
        device = torch.device("cpu")
        logger.info("Sử dụng CPU")
        # Tối ưu CPU
        torch.set_num_threads(MAX_WORKERS)
    
    # Tối ưu matmul precision cho PyTorch 2.0+
    if hasattr(torch, 'set_float32_matmul_precision'):
        torch.set_float32_matmul_precision('high')
        logger.info("Đã bật high precision matmul")
    
    logger.info(f"Đang tải mô hình PyTorch từ {MODEL_PATH}")
    
    # Nếu thư mục model không tồn tại hoặc rỗng, tự động tải
    if not os.path.exists(MODEL_PATH) or not os.listdir(MODEL_PATH):
        logger.info("Không tìm thấy mô hình, đang tải...")
        ModelManager().download_model("tts_models/multilingual/multi-dataset/xtts_v2")
    
    try:
        # Tải cấu hình và model
        if os.path.exists(os.path.join(MODEL_PATH, "config.json")):
            config_path = os.path.join(MODEL_PATH, "config.json")
        else:
            config_path = os.path.join(get_user_data_dir("tts"), 
                                     "tts_models--multilingual--multi-dataset--xtts_v2", 
                                     "config.json")
        
        config = XttsConfig()
        config.load_json(config_path)
        model = Xtts.init_from_config(config)
        
        if os.path.exists(os.path.join(MODEL_PATH, "model.pth")):
            checkpoint_path = os.path.join(MODEL_PATH, "model.pth")
        else:
            checkpoint_path = os.path.join(get_user_data_dir("tts"), 
                                         "tts_models--multilingual--multi-dataset--xtts_v2", 
                                         "model.pth")
        
        model.load_checkpoint(config, checkpoint_path)
        model.to(device)
        
        # Tối ưu cho inference
        model.eval()
        if device.type == "cuda":
            model.half()  # Dùng half precision trên GPU
            logger.info("Đã chuyển model sang half precision")
        
        # Áp dụng torch.compile nếu PyTorch 2.0+
        if hasattr(torch, 'compile'):
            try:
                model = torch.compile(model, mode='reduce-overhead')
                logger.info("Đã áp dụng torch.compile optimization")
            except Exception as e:
                logger.warning(f"Không thể áp dụng torch.compile: {e}")
        
        logger.info("Tải model thành công với đầy đủ tối ưu")
        
    except Exception as e:
        logger.error(f"Lỗi khi tải model: {e}")
        raise

def start_tts_pipeline_worker():
    """Khởi động worker xử lý các chunk TTS trong queue"""
    def pipeline_worker():
        logger.info("Pipeline worker đã khởi động")
        while True:
            try:
                task = tts_queue.get()
                if task is None:  # Signal to exit
                    break
                    
                try:
                    chunk_text, speaker_embeddings, language, result_queue, task_id = task
                    
                    with torch.no_grad():
                        # Tổng hợp giọng nói bằng PyTorch tối ưu
                        out = model.inference(
                            text=chunk_text,
                            language=language,
                            gpt_cond_latent=speaker_embeddings[0],
                            speaker_embedding=speaker_embeddings[1],
                            temperature=0.7, 
                            speed=1.0
                        )
                        wav = out["wav"]
                    
                    result_queue.put((task_id, wav))
                except Exception as e:
                    logger.error(f"Lỗi xử lý chunk TTS: {e}")
                    result_queue.put((task_id, None))
                finally:
                    tts_queue.task_done()
                    
            except Exception as e:
                logger.error(f"Lỗi trong pipeline worker: {e}")
    
    # Khởi động worker thread
    import threading
    worker_thread = threading.Thread(target=pipeline_worker, daemon=True)
    worker_thread.start()

def get_speaker_embeddings(speaker_wav_path):
    """Tạo speaker embeddings từ file WAV"""
    if speaker_wav_path in speaker_embeddings_cache:
        return speaker_embeddings_cache[speaker_wav_path]
    
    try:
        gpt_cond_latent, speaker_embedding = model.get_conditioning_latents(
            audio_path=speaker_wav_path
        )
        speaker_embeddings_cache[speaker_wav_path] = (gpt_cond_latent, speaker_embedding)
        return gpt_cond_latent, speaker_embedding
    except Exception as e:
        logger.error(f"Lỗi khi tạo speaker embeddings: {e}")
        raise

def split_text_into_chunks(text, max_chunk_size=CHUNK_SIZE):
    """Chia văn bản thành các chunk nhỏ để xử lý song song"""
    sentences = re.split(r'[.!?]+', text)
    chunks = []
    current_chunk = ""
    
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
            
        if len(current_chunk) + len(sentence) + 1 <= max_chunk_size:
            current_chunk += sentence + ". "
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = sentence + ". "
    
    if current_chunk:
        chunks.append(current_chunk.strip())
    
    return chunks

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        "status": "healthy",
        "model_loaded": model is not None,
        "device": str(device) if device else None,
        "torch_version": torch.__version__
    })

@app.route('/tts', methods=['POST'])
def text_to_speech():
    """API endpoint cho text-to-speech"""
    try:
        data = request.get_json()
        text = data.get('text', '')
        language = data.get('language', 'en')
        speaker_wav = data.get('speaker_wav', 'default_speaker.wav')
        
        if not text:
            return jsonify({"error": "Thiếu text"}), 400
        
        # Đường dẫn speaker WAV
        speaker_wav_path = os.path.join(SPEAKER_WAV_PATH, speaker_wav)
        if not os.path.exists(speaker_wav_path):
            return jsonify({"error": f"Không tìm thấy speaker file: {speaker_wav}"}), 400
        
        # Tạo speaker embeddings
        gpt_cond_latent, speaker_embedding = get_speaker_embeddings(speaker_wav_path)
        
        # Chia text thành chunks
        chunks = split_text_into_chunks(text)
        
        if len(chunks) == 1:
            # Xử lý đơn giản cho chunk duy nhất
            with torch.no_grad():
                out = model.inference(
                    text=chunks[0],
                    language=language,
                    gpt_cond_latent=gpt_cond_latent,
                    speaker_embedding=speaker_embedding,
                    temperature=0.7,
                    speed=1.0
                )
                wav = out["wav"]
        else:
            # Xử lý song song cho nhiều chunks
            result_queue = queue.Queue()
            
            # Đưa các tasks vào queue
            for i, chunk in enumerate(chunks):
                tts_queue.put((chunk, (gpt_cond_latent, speaker_embedding), language, result_queue, i))
            
            # Thu thập kết quả
            results = {}
            for _ in range(len(chunks)):
                task_id, chunk_wav = result_queue.get()
                if chunk_wav is not None:
                    results[task_id] = chunk_wav
            
            # Ghép các chunk lại
            wav_chunks = [results[i] for i in range(len(chunks)) if i in results]
            if wav_chunks:
                wav = np.concatenate(wav_chunks)
            else:
                return jsonify({"error": "Lỗi khi xử lý TTS"}), 500
        
        # Chuyển đổi sang định dạng audio và trả về
        with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as temp_file:
            sf.write(temp_file.name, wav, SAMPLE_RATE)
            temp_file_path = temp_file.name
        
        return send_file(temp_file_path, mimetype='audio/wav', as_attachment=True,
                        download_name='output.wav')
        
    except Exception as e:
        logger.error(f"Lỗi TTS: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/speakers', methods=['GET'])
def list_speakers():
    """Liệt kê các speaker có sẵn"""
    try:
        speakers = []
        if os.path.exists(SPEAKER_WAV_PATH):
            for file in os.listdir(SPEAKER_WAV_PATH):
                if file.endswith('.wav'):
                    speakers.append(file)
        return jsonify({"speakers": speakers})
    except Exception as e:
        logger.error(f"Lỗi khi liệt kê speakers: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    try:
        logger.info("Đang khởi động TTS Service tối ưu...")
        load_model()
        start_tts_pipeline_worker()
        
        port = int(os.environ.get('PORT', 5002))
        logger.info(f"TTS Service đã sẵn sàng trên port {port}")
        app.run(host='0.0.0.0', port=port, debug=False, threaded=True)
        
    except KeyboardInterrupt:
        logger.info("Đang tắt TTS Service...")
        # Đóng pipeline worker
        tts_queue.put(None)
        executor.shutdown(wait=True)
    except Exception as e:
        logger.error(f"Lỗi khởi động TTS Service: {e}")
        raise

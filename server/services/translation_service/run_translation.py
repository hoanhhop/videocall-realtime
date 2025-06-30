#!/usr/bin/env python
# -*- coding: utf-8 -*-
# run_translation.py - Flask HTTP Service cho dịch thuật sử dụng OPUS-MT

import os
import time
import logging
import torch
import multiprocessing
from concurrent.futures import ThreadPoolExecutor
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer, pipeline
from flask import Flask, request, jsonify
from pathlib import Path

# Cấu hình logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Tìm thư mục gốc của dự án
def find_project_root():
    # Đường dẫn hiện tại
    current_path = os.path.dirname(os.path.abspath(__file__))
    
    # Nếu đang trong Docker
    if os.path.exists('/app'):
        return '/app'
    
    # Nếu đang trong môi trường Windows/Local, đi lên 3 cấp từ file hiện tại
    # (từ services/translation_service lên server rồi lên thư mục gốc)
    return os.path.abspath(os.path.join(current_path, '..', '..', '..'))

# Đường dẫn mô hình tương đối
PROJECT_ROOT = find_project_root()
OPUS_MODELS_BASE_PATH = os.environ.get("OPUS_MODELS_BASE_PATH", os.path.join(PROJECT_ROOT, "server", "models", "opus_mt"))
USE_CUDA = os.environ.get("USE_CUDA", "true").lower() == "true"
MAX_LENGTH = int(os.environ.get("MAX_LENGTH", "512"))
PORT = int(os.environ.get("PORT_TRANSLATION", 50052))
# Tối ưu đa luồng
CPU_THREADS = min(int(os.environ.get("CPU_THREADS", multiprocessing.cpu_count())), 8)
NUM_WORKERS = min(int(os.environ.get("NUM_WORKERS", 2)), CPU_THREADS)
# Gộp nhóm đầu vào
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", 16 if USE_CUDA else 8))
# Queue xử lý
MAX_QUEUE_SIZE = int(os.environ.get("MAX_QUEUE_SIZE", 64))

# --- Biến toàn cục ---
translators = {}
device = None
translation_queue = {}
executor = ThreadPoolExecutor(max_workers=NUM_WORKERS)

# Thêm biến fallback
ENABLE_FALLBACK = os.environ.get("ENABLE_FALLBACK", "true").lower() == "true"  # Mặc định bật fallback

# Tối ưu phép nhân ma trận float32 cho tốc độ cao
try:
    torch.set_float32_matmul_precision('high')
except Exception:
    pass  # Không phải bản torch nào cũng hỗ trợ, bỏ qua nếu lỗi

def load_models():
    """Tải các mô hình OPUS-MT từ thư mục cục bộ"""
    global translators, device
    
    # Cấu hình CUDA cho hiệu suất tốt nhất
    if USE_CUDA and torch.cuda.is_available():
        device = torch.device("cuda")
        torch.backends.cudnn.benchmark = True  # Tối ưu hóa cudnn
        logger.info(f"Sử dụng GPU với cudnn benchmark: {torch.cuda.get_device_name(0)}")
    else:
        os.environ['OMP_NUM_THREADS'] = str(CPU_THREADS)
        torch.set_num_threads(CPU_THREADS)
        device = torch.device("cpu")
        logger.info(f"Sử dụng CPU cho model dịch thuật với {CPU_THREADS} luồng")
    
    # Danh sách các mô hình cần tải
    model_pairs = {
        "vi-en": "vi_en_model",  # Thư mục chứa mô hình dịch Việt-Anh
        "en-vi": "en_vi_model"   # Thư mục chứa mô hình dịch Anh-Việt
    }
    
    # Tải từng mô hình
    for pair, model_dir in model_pairs.items():
        model_path = os.path.join(OPUS_MODELS_BASE_PATH, model_dir)
        
        if os.path.exists(model_path):
            try:
                logger.info(f"Đang tải mô hình {pair} từ {model_path}")
                start_time = time.time()
                
                # Tải tokenizer và model
                tokenizer = AutoTokenizer.from_pretrained(model_path)
                model = AutoModelForSeq2SeqLM.from_pretrained(model_path)
                
                # Chuyển model sang thiết bị phù hợp
                model.to(device)
                
                # Sử dụng half precision nếu trên GPU để tăng tốc độ
                if device.type == "cuda":
                    model.half()  # Dùng FP16 giảm 50% bộ nhớ và tăng tốc
                
                # Nếu muốn tối ưu hơn nữa với torch.compile (PyTorch 2.0+), hãy thử:
                # try:
                #     model = torch.compile(model)
                # except Exception:
                #     pass  # Không phải model nào cũng tương thích torch.compile
                
                # Cấu hình pipeline với batch_size cao hơn và nhiều worker
                translator = pipeline(
                    "translation", 
                    model=model, 
                    tokenizer=tokenizer,
                    device=0 if device.type == "cuda" else -1,
                    batch_size=BATCH_SIZE,  # Tăng batch_size để tối ưu throughput
                    num_workers=NUM_WORKERS  # Tận dụng đa nhân khi tiền xử lý
                )
                
                translators[pair] = translator
                end_time = time.time()
                logger.info(f"Tải mô hình {pair} thành công trong {end_time - start_time:.2f} giây với batch_size={BATCH_SIZE}, workers={NUM_WORKERS}")
                
            except Exception as e:
                logger.error(f"Lỗi khi tải mô hình {pair}: {e}")
        else:
            logger.warning(f"Không tìm thấy thư mục mô hình cho cặp {pair} tại {model_path}")
    
    if not translators:
        logger.error("CẢNH BÁO: Không có mô hình dịch nào được tải thành công!")

# Tải mô hình khi khởi động
load_models()

def add_to_batch_queue(lang_pair, text, context=''):
    """Thêm văn bản vào queue xử lý batch"""
    global translation_queue
    
    if lang_pair not in translation_queue:
        translation_queue[lang_pair] = []
    
    # Thêm vào queue
    translation_queue[lang_pair].append({
        'text': text,
        'context': context,
        'timestamp': time.time()
    })
    
    # Nếu queue đầy, xử lý ngay
    if len(translation_queue[lang_pair]) >= BATCH_SIZE:
        return process_batch(lang_pair)
    
    # Nếu không đủ lớn, chỉ trả về văn bản hiện tại
    return None

def process_batch(lang_pair):
    """Xử lý batch các văn bản cùng một lúc"""
    global translation_queue
    
    if lang_pair not in translation_queue or not translation_queue[lang_pair]:
        return {}
    
    # Lấy batch từ queue
    batch = translation_queue[lang_pair]
    translation_queue[lang_pair] = []
    
    # Nếu chỉ có 1 mục, xử lý riêng
    if len(batch) == 1:
        return None
    
    # Chuẩn bị các văn bản cần dịch
    texts = []
    for item in batch:
        if item['context']:
            texts.append(f"{item['context']}\n---\n{item['text']}")
        else:
            texts.append(item['text'])
    
    try:
        # Dịch batch
        translator = translators[lang_pair]
        start_time = time.time()
        results = translator(texts, max_length=MAX_LENGTH)
        
        # Tạo dict kết quả
        translations = {}
        for i, item in enumerate(batch):
            key = f"{item['text']}_{item['timestamp']}"
            translations[key] = {
                'translated': results[i]['translation_text'],
                'processing_time': time.time() - start_time
            }
        
        logger.info(f"Đã dịch batch {len(batch)} văn bản trong {time.time() - start_time:.3f} giây")
        return translations
    
    except Exception as e:
        logger.error(f"Lỗi khi dịch batch: {e}")
        return None

# Định kỳ xử lý batch chưa đầy
def process_pending_batches():
    """Xử lý các batch đang chờ nếu đã đợi quá lâu"""
    for lang_pair in list(translation_queue.keys()):
        if translation_queue[lang_pair]:
            current_time = time.time()
            oldest_item = translation_queue[lang_pair][0]
            
            # Nếu item đã chờ > 0.5 giây, xử lý
            if current_time - oldest_item['timestamp'] > 0.5:
                process_batch(lang_pair)

@app.route('/health', methods=['GET'])
def health_check():
    """Kiểm tra trạng thái của dịch vụ"""
    if not translators:
        return jsonify({"status": "error", "message": "Không có mô hình dịch nào được tải"}), 500
    
    return jsonify({
        "status": "ok", 
        "message": "Translation service đang chạy",
        "models": list(translators.keys()),
        "device": str(device),
        "max_length": MAX_LENGTH,
        "batch_size": BATCH_SIZE,
        "workers": NUM_WORKERS
    }), 200

@app.route('/translate', methods=['POST'])
def translate():
    """Dịch văn bản từ ngôn ngữ nguồn sang ngôn ngữ đích"""
    data = request.get_json()
    
    if not data or 'text' not in data:
        return jsonify({"error": "Thiếu text để dịch"}), 400
    
    source_lang = data.get('source', 'vi').lower()
    target_lang = data.get('target', 'en').lower()
    
    # Xác định cặp ngôn ngữ
    lang_pair = f"{source_lang}-{target_lang}"
    
    # Kiểm tra xem cặp ngôn ngữ có được hỗ trợ không
    if lang_pair not in translators:
        # Thử đảo ngược nếu có thể
        reversed_pair = f"{target_lang}-{source_lang}"
        if reversed_pair in translators:
            return jsonify({"error": f"Cặp ngôn ngữ {lang_pair} không được hỗ trợ. Thử {reversed_pair} thay thế"}), 400
        else:
            return jsonify({"error": f"Cặp ngôn ngữ {lang_pair} không được hỗ trợ"}), 400
    
    text = data['text']
    context = data.get('context', '')
    
    # Bỏ qua văn bản trống
    if not text.strip():
        return jsonify({"translated": ""})
    
    # Đối với câu ngắn (dưới 20 từ), thử thêm vào batch
    # Tắt batching mặc định vì gây lỗi pickle
    if len(text.split()) < 20 and not data.get('disable_batching', True):
        # Tạo key duy nhất cho văn bản
        text_key = f"{text}_{time.time()}"
        
        # Thêm vào queue và kiểm tra kết quả batch
        batch_result = add_to_batch_queue(lang_pair, text, context)
        
        # Nếu đã xử lý batch và có kết quả cho văn bản này
        if batch_result and text_key in batch_result:
            return jsonify(batch_result[text_key])
    
    # Xử lý văn bản riêng lẻ (nếu không được batch)
    # Thêm ngữ cảnh nếu có
    if context:
        # Đơn giản chỉ thêm ngữ cảnh vào đầu, ngăn cách bằng "\n---\n"
        # Trong thực tế, có thể cần phương pháp phức tạp hơn để tích hợp ngữ cảnh
        enhanced_text = f"{context}\n---\n{text}"
    else:
        enhanced_text = text
    
    # Giới hạn độ dài để tránh lỗi
    if len(enhanced_text) > MAX_LENGTH * 2:  # Giảm xuống 2x để tránh OOM
        enhanced_text = enhanced_text[:MAX_LENGTH * 2]
        logger.warning(f"Văn bản quá dài, đã cắt bớt còn khoảng {MAX_LENGTH} token")
    
    try:
        # Ghi thời gian bắt đầu để đo độ trễ
        start_time = time.time()
        
        # Xử lý trực tiếp để tránh lỗi pickle với multiprocessing
        # Thực hiện dịch thuật
        translator = translators[lang_pair]
        result = translator(enhanced_text, max_length=MAX_LENGTH)
        translated_text = result[0]['translation_text']
        
        # Tính thời gian dịch
        processing_time = time.time() - start_time
        logger.info(f"Dịch thuật hoàn tất trong {processing_time:.3f} giây")
        
        return jsonify({
            "translated": translated_text,
            "processing_time": round(processing_time, 3)
        })
    
    except Exception as e:
        logger.error(f"Lỗi khi dịch: {str(e)}")
        
        if ENABLE_FALLBACK:
            # Trả về fallback khi lỗi để client không bị treo
            return jsonify({
                "translated": f"[Lỗi dịch thuật] {text[:50]}...",
                "error": str(e),
                "original": text,
                "is_fallback": True
            })
        else:
            return jsonify({"error": str(e)}), 500

@app.route('/create-glossary', methods=['POST'])
def create_glossary():
    """Tạo từ điển thuật ngữ từ các thuật ngữ được cung cấp"""
    data = request.get_json()
    
    if not data or 'terms' not in data:
        return jsonify({"error": "Thiếu danh sách thuật ngữ"}), 400
    
    terms = data.get('terms', [])
    source = data.get('source', 'vi').lower()
    target = data.get('target', 'en').lower()
    
    # Xác định cặp ngôn ngữ
    lang_pair = f"{source}-{target}"
    
    # Kiểm tra xem cặp ngôn ngữ có được hỗ trợ không
    if lang_pair not in translators:
        return jsonify({"error": f"Cặp ngôn ngữ {lang_pair} không được hỗ trợ để tạo glossary"}), 400
    
    # Bỏ qua nếu không có thuật ngữ
    if not terms:
        return jsonify({"glossary": []})
    
    try:
        # Dịch từng thuật ngữ
        translator = translators[lang_pair]
        glossary = []
        
        for term in terms:
            if term.strip():
                result = translator(term, max_length=50)  # Các thuật ngữ thường ngắn
                translated = result[0]['translation_text']
                
                glossary.append({
                    "source": term,
                    "target": translated
                })
        
        logger.info(f"Đã tạo glossary với {len(glossary)} thuật ngữ")
        return jsonify({"glossary": glossary})
    
    except Exception as e:
        logger.error(f"Lỗi khi tạo glossary: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    logger.info(f"Starting Translation service on port {PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=False) 
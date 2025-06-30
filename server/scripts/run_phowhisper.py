#!/usr/bin/env python
# -*- coding: utf-8 -*-
# run_phowhisper.py - gRPC Service for PhoWhisper ASR (tối ưu cho CPU/GPU)
import os
import sys
import argparse
import time
import wave
import gc
import numpy as np
import torch
import hashlib
import re
from concurrent import futures
import grpc
import psutil # Để kiểm tra RAM

# Thêm đường dẫn protos vào sys.path để import
sys.path.append(os.path.join(os.path.dirname(__file__), '../protos'))

import speech_pb2
import speech_pb2_grpc
# Import health checking protos
from grpc_health.v1 import health_pb2
from grpc_health.v1 import health_pb2_grpc

# --- Cấu hình PyTorch và Thiết bị ---
# Ưu tiên sử dụng biến môi trường nếu có, nếu không thì dùng giá trị mặc định
num_threads = int(os.environ.get("OMP_NUM_THREADS", psutil.cpu_count(logical=False))) # Số luồng vật lý
torch.set_num_threads(num_threads)
# Giới hạn số luồng interop để tránh xung đột
torch.set_num_interop_threads(max(1, num_threads // 2))
# Tắt cudnn benchmark nếu không dùng GPU hoặc không chắc chắn
torch.backends.cudnn.benchmark = False

# --- Kiểm tra các backend tùy chọn ---
# Giữ lại để tham khảo, nhưng logic chính sẽ dùng PyTorch
try:
    import onnxruntime as ort
    has_onnx_runtime = True
    print("ONNX Runtime được tìm thấy (nhưng không được sử dụng mặc định).", flush=True)
except ImportError:
    has_onnx_runtime = False
    print("ONNX Runtime không khả dụng.", flush=True)

try:
    from openvino.runtime import Core
    has_openvino = True
    print("OpenVINO được tìm thấy (nhưng không được sử dụng mặc định).", flush=True)
except ImportError:
    has_openvino = False
    print("OpenVINO không khả dụng.", flush=True)

from transformers import pipeline, AutoProcessor, AutoModelForSpeechSeq2Seq

# Biến toàn cục
asr_pipeline = None
model = None
processor = None
model_path = None
device = None
torch_dtype = None
using_lightweight_mode = False

# Bộ nhớ đệm kết quả
result_cache = {}
MAX_CACHE_SIZE = 100
MAX_AUDIO_LENGTH = 5 * 16000  # Giới hạn 5 giây âm thanh

# Cấu hình Whisper
WHISPER_LANGUAGE = "vi"
WHISPER_TASK = "transcribe"

# Ngưỡng độ tin cậy
CONFIDENCE_THRESHOLD = 0.5

# Các mẫu chuẩn hóa
common_patterns = {
    r'alo+\s*alo+': 'alo alo',
    r'một\s+hai\s+ba\s+bốn': 'một hai ba bốn',
    r'xin\s+chào': 'xin chào',
    r'xin\s+lỗi': 'xin lỗi',
    r'cảm\s+ơn': 'cảm ơn',
    r'tạm\s+biệt': 'tạm biệt',
}

def post_process_text(text, language="vi"):
    """Hậu xử lý văn bản để cải thiện chất lượng"""
    if not text:
        return text

    # Chuẩn hóa khoảng trắng
    text = ' '.join(text.split())

    # Chuyển về chữ thường để xử lý dễ hơn
    text_lower = text.lower()

    # Áp dụng các mẫu chuẩn hóa thông dụng
    for pattern, replacement in common_patterns.items():
        if re.search(pattern, text_lower):
            # Ưu tiên trả về các mẫu này ngay lập tức
            return replacement

    # Xử lý trường hợp "alo" hoặc các biến thể
    if re.search(r'al+o+|hel+o+|ha+\s*lo+|a\s*lô', text_lower):
        return "alo"

    # Nếu có các số đọc liên tiếp, giữ lại chỉ phần này
    number_match = re.search(r'(một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười)(\s+(một|hai|ba|bốn|năm|sáu|bảy|tám|chín|mười))+', text_lower)
    if number_match:
        return number_match.group(0).strip()

    # Logic khác (tùy chọn, có thể bỏ nếu không cần)
    # Ví dụ: loại bỏ dấu chấm ở cuối nếu không phải câu hoàn chỉnh
    # if len(text.split()) < 5 and text.endswith('.'):
    #    text = text[:-1]

    return text

def perform_recognition(audio_data, language):
    """Thực hiện nhận dạng giọng nói từ dữ liệu audio bytes"""
    global model, processor, device, torch_dtype, asr_pipeline, result_cache, using_lightweight_mode

    start_time = time.time()
    try:
        # Tạo hash của âm thanh để kiểm tra cache
        audio_hash = hashlib.md5(audio_data).hexdigest()

        # Kiểm tra cache
        if audio_hash in result_cache:
            cached_result = result_cache[audio_hash]
            print(f"🚀 Cache hit for {audio_hash[:8]}", flush=True)
            cached_result['timestamp'] = time.time()
            cached_result['inferenceTime'] = 0
            return cached_result

        # Chuyển đổi bytes thành mảng numpy float32
        audio_np = np.frombuffer(audio_data, dtype=np.int16).astype(np.float32) / 32768.0
        sample_rate = 16000 # Giả định sample rate là 16kHz
        audio_duration = len(audio_np) / sample_rate

        # Kiểm tra năng lượng âm thanh (ngưỡng có thể cần điều chỉnh)
        audio_energy = np.mean(np.abs(audio_np))
        if audio_energy < 0.0015: # Tăng nhẹ ngưỡng để tránh nhiễu
             print(f"🎤 Âm thanh quá yếu ({audio_energy:.4f}), bỏ qua.", flush=True)
             return {
                'text': "", 'original_text': "", 'language': language, 'confidence': 0,
                'inferenceTime': 0, 'isTransformers': True, 'audio_energy': float(audio_energy),
                'audio_duration': audio_duration, 'isEmpty': True, 'timestamp': time.time()
             }

        # Tham số generation (có thể tinh chỉnh thêm)
        generation_config = {
            "max_length": 128, # Tăng nhẹ max_length
            "min_length": 0,
            "no_repeat_ngram_size": 3,
            "num_beams": 1, # Beam search = 1 cho tốc độ nhanh nhất
            "return_timestamps": False # Không cần timestamp
        }
        # Điều chỉnh max_new_tokens dựa trên thời lượng, giới hạn tối đa
        words_per_second_estimate = 3 # Ước lượng số từ mỗi giây
        max_new_tokens = min(int(audio_duration * words_per_second_estimate) + 10, 75) # Giới hạn 75 tokens
        generation_config["max_new_tokens"] = max(5, max_new_tokens) # Ít nhất 5 tokens

        text = None
        model_method = "unknown"

        # Ưu tiên sử dụng model và processor trực tiếp
        if model is not None and processor is not None:
            try:
                # Chuẩn bị input features
                input_features = processor(
                    audio_np,
                    sampling_rate=sample_rate,
                    return_tensors="pt"
                ).input_features

                # Chuyển input lên đúng device
                if device:
                    input_features = input_features.to(device, dtype=torch_dtype)

                # ID cho ngôn ngữ và task
                forced_decoder_ids = processor.get_decoder_prompt_ids(
                    language=WHISPER_LANGUAGE,
                    task=WHISPER_TASK
                )

                # Thực hiện inference không tính gradient
                with torch.no_grad():
                    predicted_ids = model.generate(
                        input_features,
                        forced_decoder_ids=forced_decoder_ids,
                        **generation_config
                    )

                # Decode kết quả
                text = processor.batch_decode(predicted_ids, skip_special_tokens=True)[0]
                model_method = f"pytorch_{device.type}" # Ghi lại device sử dụng (cpu/cuda)

            except Exception as pytorch_error:
                print(f"Lỗi khi sử dụng PyTorch trực tiếp ({device}): {str(pytorch_error)}", flush=True)
                text = None # Thử fallback qua pipeline nếu có lỗi

        # Fallback sử dụng pipeline (ít hiệu quả hơn)
        if text is None and asr_pipeline:
             try:
                # Pipeline tự xử lý device và dtype đã cấu hình lúc tạo
                result_pipeline = asr_pipeline(
                    audio_np.copy(), # Tạo bản sao để tránh thay đổi không mong muốn
                    language=WHISPER_LANGUAGE,
                    task=WHISPER_TASK,
                    generate_kwargs=generation_config,
                    chunk_length_s=30, # Xử lý audio dài (nếu cần)
                    stride_length_s=5
                )
                text = result_pipeline["text"]
                model_method = f"pipeline_{device.type}"
             except Exception as pipeline_error:
                print(f"Lỗi khi sử dụng pipeline fallback ({device}): {str(pipeline_error)}", flush=True)
                text = "Xin chào" # Giá trị fallback cuối cùng
                model_method = "fallback"
        elif text is None:
             # Nếu cả 2 cách trên đều lỗi hoặc không có model/pipeline
             text = "Xin chào"
             model_method = "fallback"

        # Hậu xử lý văn bản
        original_text = text.strip() # Loại bỏ khoảng trắng thừa đầu/cuối
        processed_text = post_process_text(original_text, language)

        print(f"📝 Gốc ({model_method}): '{original_text}'", flush=True)
        print(f"✨ Đã xử lý: '{processed_text}'", flush=True)
            
            inference_time = time.time() - start_time
            
        # Giải phóng bộ nhớ (quan trọng hơn khi dùng GPU)
        if device and device.type == 'cuda':
            torch.cuda.empty_cache()
        if using_lightweight_mode:
            gc.collect()

        # Đánh giá độ tin cậy (logic đơn giản, có thể cải thiện)
        confidence = 0.95
        # Giảm độ tin cậy nếu text xử lý khác nhiều so với gốc
        if original_text != processed_text:
            # Dùng khoảng cách Levenshtein hoặc tương tự sẽ tốt hơn
            len_diff = abs(len(original_text) - len(processed_text)) / max(len(original_text), 1)
            confidence = max(0.5, 0.95 - len_diff * 0.7) # Giảm mạnh hơn nếu khác biệt lớn

        # Giảm độ tin cậy nếu text quá ngắn hoặc quá dài so với audio
        word_count = len(processed_text.split())
        expected_word_min = max(0, int(audio_duration * 1.0) - 2) # Khoảng 1 từ/giây
        expected_word_max = int(audio_duration * 5.0) + 5    # Khoảng 5 từ/giây
        if not (expected_word_min <= word_count <= expected_word_max) and word_count > 0:
            confidence = max(0.4, confidence * 0.8) # Giảm 20% nếu số từ bất thường

        # Chuẩn bị kết quả dạng dict
        result = {
            'text': processed_text,
            'original_text': original_text,
                'language': language,
            'confidence': round(confidence, 3), # Làm tròn confidence
                'inferenceTime': round(inference_time * 1000, 2), # ms
            'isTransformers': True,
            'model_type': model_method, # Thêm thông tin phương thức và device
            'audio_energy': round(float(audio_energy), 5), # Làm tròn energy
            'audio_duration': round(audio_duration, 3), # Làm tròn duration (s)
            'isEmpty': len(processed_text) == 0,
            'timestamp': time.time()
        }

        # Lưu vào cache (cần cơ chế xóa cache cũ hiệu quả hơn)
        # Loại bỏ các mục cũ nhất nếu cache đầy
        if len(result_cache) >= MAX_CACHE_SIZE:
            # Tìm và xóa 10% mục cũ nhất
            num_to_remove = max(1, MAX_CACHE_SIZE // 10)
            sorted_keys = sorted(result_cache.keys(), key=lambda k: result_cache[k].get('timestamp', 0))
            for i in range(min(num_to_remove, len(sorted_keys))):
                del result_cache[sorted_keys[i]]
        result_cache[audio_hash] = result

        return result
            
    except Exception as e:
        print(f"Lỗi nghiêm trọng khi nhận dạng: {str(e)}", flush=True)
        import traceback
        traceback.print_exc() # In traceback để debug
        # Trả về lỗi hoặc kết quả mặc định an toàn
        return {
            'text': "Lỗi xử lý", 'original_text': "Lỗi xử lý", 'language': language, 'confidence': 0,
            'inferenceTime': round((time.time() - start_time) * 1000, 2), 'isTransformers': True,
            'audio_energy': 0, 'audio_duration': 0, 'isEmpty': True, 'timestamp': time.time(), 'error': str(e)
        }

# --- gRPC Servicer ---
class SpeechRecognitionServicer(speech_pb2_grpc.SpeechRecognitionServicer):
    """Cung cấp các phương thức cho gRPC service"""

    def Recognize(self, request, context):
        """Nhận request gRPC và trả về kết quả nhận dạng"""
        # Kiểm tra xem model đã sẵn sàng chưa (qua health check sẽ tốt hơn)
        if model is None or processor is None:
             context.set_code(grpc.StatusCode.UNAVAILABLE)
             context.set_details("Model chưa sẵn sàng.")
             return speech_pb2.RecognizeResponse()

        print(f"📡 Nhận request gRPC: {len(request.audio_content)} bytes, lang={request.language}", flush=True)

        # Gọi hàm nhận dạng cốt lõi
        result_dict = perform_recognition(request.audio_content, request.language)

        # Chuyển đổi dict kết quả sang gRPC response message
        response = speech_pb2.RecognizeResponse(
            text=result_dict.get('text', ''),
            original_text=result_dict.get('original_text', ''),
            confidence=result_dict.get('confidence', 0.0),
            language=result_dict.get('language', request.language),
            inference_time_ms=result_dict.get('inferenceTime', 0.0),
            audio_duration_s=result_dict.get('audio_duration', 0.0),
            is_empty=result_dict.get('isEmpty', True),
            audio_energy=result_dict.get('audio_energy', 0.0)
        )
        # Log ngắn gọn kết quả trả về
        log_text = response.text[:30] + ('...' if len(response.text) > 30 else '')
        print(f"✅ Trả về response gRPC: text='{log_text}', conf={response.confidence:.2f}, time={response.inference_time_ms:.0f}ms", flush=True)
        return response

# --- Implement gRPC Health Checking Servicer ---
class HealthServicer(health_pb2_grpc.HealthServicer):
    def Check(self, request, context):
        # Kiểm tra xem model và processor đã load thành công chưa
        if model is not None and processor is not None:
             # Có thể thêm kiểm tra khác, ví dụ: thử inference một mẫu nhỏ
             print("🩺 Health Check: SERVING", flush=True)
             return health_pb2.HealthCheckResponse(status=health_pb2.HealthCheckResponse.SERVING)
        else:
             print("🩺 Health Check: NOT_SERVING (Model chưa sẵn sàng)", flush=True)
             return health_pb2.HealthCheckResponse(status=health_pb2.HealthCheckResponse.NOT_SERVING)

    def Watch(self, request, context):
        # Watch là một stream, trả về trạng thái liên tục nếu có thay đổi
        # Implement đơn giản: trả về trạng thái hiện tại mỗi 5 giây
        while True:
            if model is not None and processor is not None:
                 current_status = health_pb2.HealthCheckResponse.SERVING
            else:
                 current_status = health_pb2.HealthCheckResponse.NOT_SERVING
            yield health_pb2.HealthCheckResponse(status=current_status)
            time.sleep(5) # Kiểm tra lại sau mỗi 5 giây

def load_model(model_path_arg, device_arg, lightweight_arg):
    """Tải mô hình PhoWhisper với tùy chọn thiết bị và chế độ nhẹ"""
    global asr_pipeline, model, processor, model_path, device, torch_dtype, using_lightweight_mode

    model_path = model_path_arg
    using_lightweight_mode = lightweight_arg

    try:
        # Xác định thiết bị (device)
        if device_arg:
            if device_arg == "cuda" and not torch.cuda.is_available():
                print("⚠️ Cảnh báo: Yêu cầu CUDA nhưng không khả dụng, fallback về CPU.", flush=True)
                device = torch.device("cpu")
            elif "cuda" in device_arg and torch.cuda.is_available():
                 try:
                    device = torch.device(device_arg)
                    # Kiểm tra xem device có hợp lệ không
                    _ = torch.tensor([1.0]).to(device)
                 except Exception as e:
                    print(f"⚠️ Thiết bị CUDA '{device_arg}' không hợp lệ ({e}), fallback về 'cuda:0' hoặc 'cpu'.", flush=True)
                    if torch.cuda.device_count() > 0:
                         device = torch.device("cuda:0")
                    else:
                         device = torch.device("cpu")
            elif device_arg == "cpu":
                device = torch.device("cpu")
            else:
                 print(f"⚠️ Thiết bị '{device_arg}' không được hỗ trợ, fallback về tự động phát hiện.", flush=True)
                 device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        else:
            # Tự động phát hiện
            device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

        # Xác định kiểu dữ liệu (torch_dtype)
        if device.type == 'cuda':
            # Kiểm tra xem GPU có hỗ trợ float16 không (ví dụ: Ampere trở lên)
            capability = torch.cuda.get_device_capability(device)
            if capability >= (7, 0): # Volta, Turing, Ampere+ hỗ trợ float16 tốt
                torch_dtype = torch.float16
                print("🚀 Sử dụng dtype float16 (tối ưu cho GPU hỗ trợ).", flush=True)
            else:
                torch_dtype = torch.float32
                print("💡 Sử dụng dtype float32 trên GPU (không hỗ trợ float16 tối ưu).", flush=True)
            # Giải phóng bộ nhớ cache GPU trước khi tải model
            torch.cuda.empty_cache()
        else:
            torch_dtype = torch.float32
            print("💡 Sử dụng dtype float32 trên CPU.", flush=True)

        print(f"⚙️ Đang tải mô hình PhoWhisper từ '{model_path}' lên thiết bị '{device}'...", flush=True)

        # Giải phóng bộ nhớ RAM trước khi tải
        gc.collect()

        # Tải Processor
        processor = AutoProcessor.from_pretrained(model_path)
        print("✅ Processor đã tải.", flush=True)

        # Tải Model
        print("⏳ Bắt đầu tải model (có thể mất vài phút)...", flush=True)
        model_load_start = time.time()

        # Cấu hình tải model
        model_kwargs = {
             "torch_dtype": torch_dtype,
             "low_cpu_mem_usage": lightweight_arg or (device.type == 'cuda'), # Luôn dùng low_cpu nếu là GPU
             "use_safetensors": True # Ưu tiên safetensors
        }

        if lightweight_arg and device.type == 'cpu':
             # Chế độ lightweight chỉ thực sự cần thiết cho CPU yếu
             # os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "max_split_size_mb:32" # Không áp dụng cho CPU
             print("🐌 Chế độ lightweight đang được kích hoạt cho CPU (giảm sử dụng RAM khi tải).", flush=True)
             model_kwargs["low_cpu_mem_usage"] = True
        elif device.type == 'cuda':
             print("⚡ Kích hoạt tối ưu low_cpu_mem_usage khi tải lên GPU.", flush=True)
             model_kwargs["low_cpu_mem_usage"] = True # Giảm RAM peak khi load lên GPU


        model = AutoModelForSpeechSeq2Seq.from_pretrained(
            model_path,
            **model_kwargs
        )
        print(f"✅ Model đã tải xong từ disk sau {time.time() - model_load_start:.2f} giây.", flush=True)

        # Chuyển model lên device
        model.to(device)
        print(f"✅ Model đã chuyển lên thiết bị '{device}'.", flush=True)

        # Chuyển sang chế độ đánh giá (quan trọng!)
        model.eval()
        print("✅ Model đã chuyển sang chế độ eval().", flush=True)

        # Tối ưu hóa mô hình với torch.compile (tùy chọn, yêu cầu PyTorch 2.0+)
        # Thường hiệu quả hơn trên GPU và các tác vụ lặp lại
        # if not lightweight_arg and device.type == 'cuda' and hasattr(torch, 'compile'):
        #     try:
        #         print("⏳ Đang thử tối ưu hóa model với torch.compile()...", flush=True)
        #         # Các mode: 'default', 'reduce-overhead', 'max-autotune'
        #         model = torch.compile(model, mode="reduce-overhead")
        #         print("✅ Đã tối ưu hóa mô hình với torch.compile()!", flush=True)
        #     except Exception as e:
        #         print(f"⚠️ Không thể tối ưu hóa mô hình với torch.compile(): {e}", flush=True)

        # Tạo pipeline (chỉ dùng làm fallback)
        try:
            print("⏳ Tạo pipeline fallback...", flush=True)
            asr_pipeline = pipeline(
                "automatic-speech-recognition",
                model=model, # Sử dụng model đã tải và chuyển device
                tokenizer=processor.tokenizer,
                feature_extractor=processor.feature_extractor,
                device=device, # Pipeline cũng cần biết device
                torch_dtype=torch_dtype # Và dtype
            )
            print("✅ Pipeline fallback đã được tạo.", flush=True)
        except Exception as pipeline_err:
             print(f"⚠️ Không thể tạo pipeline fallback: {str(pipeline_err)}", flush=True)
             asr_pipeline = None

        print(f"🎉 PhoWhisper model đã được tải thành công trên '{device}'!", flush=True)
        print(f"   Chế độ lightweight: {'Bật' if lightweight_arg else 'Tắt'}", flush=True)
        print(f"   Sử dụng dtype: {torch_dtype}", flush=True)
        # Giải phóng bộ nhớ không cần thiết sau khi tải xong
        gc.collect()
        if device.type == 'cuda': torch.cuda.empty_cache()
        return True

    except Exception as e:
        print(f"❌ Lỗi nghiêm trọng khi tải mô hình: {str(e)}", flush=True)
        import traceback
        traceback.print_exc()
        # Đặt lại biến toàn cục về None để health check báo lỗi
        model = None
        processor = None
        asr_pipeline = None
        return False

def serve(port, model_path_arg, device_arg, lightweight_arg):
    """Khởi động gRPC server"""
    # Tải model trước khi khởi động server
    print("--- Bắt đầu quá trình tải model ---", flush=True)
    load_success = load_model(model_path_arg, device_arg, lightweight_arg)
    print("--- Kết thúc quá trình tải model ---", flush=True)

    if not load_success:
        print("❌ Không thể tải mô hình, server không thể khởi động.", flush=True)
        sys.exit(1) # Thoát nếu không tải được model

    # Cấu hình server gRPC
    server = grpc.server(
        futures.ThreadPoolExecutor(max_workers=num_threads * 2), # Tăng nhẹ số worker
        options=[
            ('grpc.max_send_message_length', 50 * 1024 * 1024), # 50MB
            ('grpc.max_receive_message_length', 50 * 1024 * 1024), # 50MB
            ('grpc.so_reuseport', 1), # Cho phép reuse port
            ('grpc.keepalive_time_ms', 10000), # 10 giây
            ('grpc.keepalive_timeout_ms', 5000), # 5 giây
            ('grpc.keepalive_permit_without_calls', True),
            ('grpc.http2.min_ping_interval_without_data_ms', 5000), # 5 giây
        ]
     )

    # Đăng ký service chính
    speech_pb2_grpc.add_SpeechRecognitionServicer_to_server(SpeechRecognitionServicer(), server)
    # Đăng ký health checking service
    health_pb2_grpc.add_HealthServicer_to_server(HealthServicer(), server)

    # Lắng nghe trên tất cả các interface
    listen_addr = f'[::]:{port}'
    server.add_insecure_port(listen_addr)

    print(f"🚀 Khởi động gRPC server trên cổng {port}...", flush=True)
    print(f"   Thiết bị xử lý: {device}", flush=True)
    print(f"   Số luồng xử lý tối đa: {num_threads}", flush=True)
    server.start()
    print(f"✅ Server đang lắng nghe tại {listen_addr}", flush=True)
    print("🩺 Health check endpoint sẵn sàng.", flush=True)

    # Giữ cho tiến trình chính chạy
    try:
        server.wait_for_termination()
    except KeyboardInterrupt:
        print("\n🛑 Nhận tín hiệu dừng, đang tắt server...", flush=True)
        server.stop(grace=5).wait() # Chờ tối đa 5 giây để xử lý xong request
        print("✅ Server đã dừng.", flush=True)

if __name__ == '__main__':
    # --- Tạo mã gRPC nếu cần ---
    proto_dir = os.path.join(os.path.dirname(__file__), '../protos')
    proto_file = os.path.join(proto_dir, 'speech.proto')
    health_proto_file = None # Cần tìm file health.proto gốc nếu muốn generate

    # Kiểm tra và tạo thư mục protos
    if not os.path.exists(proto_dir):
        os.makedirs(proto_dir)

    # Kiểm tra file speech_pb2.py và speech_pb2_grpc.py
    pb2_file = os.path.join(proto_dir, 'speech_pb2.py')
    pb2_grpc_file = os.path.join(proto_dir, 'speech_pb2_grpc.py')
    speech_proto_exists = os.path.exists(proto_file)
    speech_pb2_exists = os.path.exists(pb2_file)
    speech_pb2_grpc_exists = os.path.exists(pb2_grpc_file)

    # Chỉ tạo lại nếu file proto tồn tại và mới hơn file py đã tạo
    should_generate_speech = False
    if speech_proto_exists:
        proto_mtime = os.path.getmtime(proto_file)
        pb2_mtime = os.path.getmtime(pb2_file) if speech_pb2_exists else -1
        pb2_grpc_mtime = os.path.getmtime(pb2_grpc_file) if speech_pb2_grpc_exists else -1
        if proto_mtime > pb2_mtime or proto_mtime > pb2_grpc_mtime:
            should_generate_speech = True

    if should_generate_speech:
        print("⏳ Đang tạo mã gRPC Python từ speech.proto...", flush=True)
        try:
            from grpc_tools import protoc
            protoc.main((
                '',
                f'-I{proto_dir}',
                f'--python_out={proto_dir}',
                f'--grpc_python_out={proto_dir}',
                proto_file,
            ))
            print("✅ Tạo mã gRPC cho speech.proto thành công.", flush=True)
            # Import lại để đảm bảo sử dụng code mới nhất
            try:
                import importlib
                sys.path.insert(0, proto_dir) # Đảm bảo import đúng thư mục
                if 'speech_pb2' in sys.modules: importlib.reload(sys.modules['speech_pb2'])
                if 'speech_pb2_grpc' in sys.modules: importlib.reload(sys.modules['speech_pb2_grpc'])
                import speech_pb2, speech_pb2_grpc # Import lại
                print("🔄 Đã import lại module speech gRPC.", flush=True)
            except Exception as import_err:
                 print(f"⚠️ Lỗi khi import lại module gRPC: {import_err}", flush=True)

        except ImportError:
            print("❌ Lỗi: grpcio-tools chưa được cài đặt. Không thể tự động tạo mã gRPC.", flush=True)
            sys.exit(1)
        except Exception as e:
             print(f"❌ Lỗi không xác định khi tạo mã gRPC: {e}", flush=True)
             sys.exit(1)
    elif speech_pb2_exists and speech_pb2_grpc_exists:
         print("🆗 Mã gRPC Python (speech.proto) đã tồn tại và cập nhật.", flush=True)
    else:
         print("❌ Lỗi: Không tìm thấy file speech.proto hoặc mã Python tương ứng.", flush=True)
         print(f"   Kiểm tra sự tồn tại của '{proto_file}'", flush=True)
         sys.exit(1)

    # Tạo mã cho health check (thường được cài đặt sẵn bởi grpcio-health-checking)
    # Nếu cần tạo thủ công: python -m grpc_tools.protoc -I<path_to_grpc_protos> --python_out=. --grpc_python_out=. health.proto

    # --- Phân tích tham số dòng lệnh ---
    parser = argparse.ArgumentParser(description='PhoWhisper Speech Recognition gRPC Service')
    parser.add_argument('--model_path', type=str, required=True, help='Đường dẫn đến mô hình PhoWhisper đã tải (thư mục chứa config.json, ...)')
    parser.add_argument('--port', type=int, default=50051, help='Cổng chạy gRPC service (mặc định: 50051)')
    parser.add_argument('--device', type=str, default=None, help='Thiết bị chạy model (ví dụ: "cpu", "cuda", "cuda:0"). Mặc định tự động phát hiện.')
    parser.add_argument('--lightweight', action='store_true', help='Kích hoạt chế độ nhẹ (giảm sử dụng bộ nhớ khi tải, đặc biệt hữu ích cho CPU)')
    args = parser.parse_args()
    
    # Kiểm tra nhanh các thư viện chính trước khi chạy server
    try:
        print("🩺 Kiểm tra các thư viện cần thiết...", flush=True)
        import torch
        import transformers
        import grpc
        import grpc_health
        print("✅ Các thư viện chính đã được cài đặt.", flush=True)
    except ImportError as e:
        print(f"❌ Lỗi: Thiếu thư viện quan trọng: {e.name}", flush=True)
        print("   Vui lòng cài đặt các thư viện trong requirements.txt", flush=True)
        print("   pip install -r scripts/requirements.txt", flush=True)
        sys.exit(1)

    # Khởi động server
    serve(args.port, args.model_path, args.device, args.lightweight)

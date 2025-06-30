import os
import logging
import time
from flask import Flask, request, jsonify
from faster_whisper import WhisperModel
import torch
from dotenv import load_dotenv
import tempfile
import numpy as np
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import traceback
import mimetypes
import av  # Thêm import av để xử lý định dạng audio
import subprocess
import shutil
import pkg_resources

# Thêm import cần thiết cho Transformers (chỉ dùng để lấy processor nếu CT2 không có sẵn)
# from transformers import WhisperForConditionalGeneration, WhisperProcessor, WhisperTokenizer

# Tải biến môi trường từ file .env (nếu có)
load_dotenv()

# Cấu hình logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__)

# Tìm thư mục gốc của dự án
def find_project_root():
    current_path = os.path.dirname(os.path.abspath(__file__))
    if os.path.exists('/app'): # Docker
        return '/app'
    return os.path.abspath(os.path.join(current_path, '..', '..', '..'))

PROJECT_ROOT = find_project_root()
# Sử dụng đường dẫn model từ environment variable hoặc cache directory
MODEL_PATH_CT2 = os.getenv("MODEL_PATH_CT2", "/root/.cache/huggingface/transformers/models--vinai--PhoWhisper-medium-ct2")
# Fallback paths for different environments
if not os.path.exists(MODEL_PATH_CT2):
    # Try mounted volume path
    fallback_path = "/app/models/phowhisper/PhoWhisper-medium-ct2"
    if os.path.exists(fallback_path):
        MODEL_PATH_CT2 = fallback_path
    else:
        # Try local development path
        local_path = os.path.join(PROJECT_ROOT, "server", "models", "phowhisper", "PhoWhisper-medium-ct2")
        if os.path.exists(local_path):
            MODEL_PATH_CT2 = local_path

asr_model = None
model_device = "cpu"
model_compute_type = "int8" # int8 cho CPU CT2 là tốt nhất
MAX_WORKERS = int(os.getenv("MAX_WORKERS", 4))
executor = ThreadPoolExecutor(max_workers=MAX_WORKERS)
token_buffer = {}
# Cache cho streaming state
streaming_state_cache = {}

# Đọc cổng từ biến môi trường, mặc định là 50051
PORT = int(os.getenv("PORT_ASR", 50051))

# In ra phiên bản của faster-whisper để debug
faster_whisper_version = pkg_resources.get_distribution("faster-whisper").version
print(f"Faster Whisper version: {faster_whisper_version}")

# Tối ưu phép nhân ma trận float32 cho tốc độ cao
try:
    torch.set_float32_matmul_precision('high')
except Exception:
    pass  # Không phải bản torch nào cũng hỗ trợ, bỏ qua nếu lỗi

# Hàm trợ giúp để kiểm tra định dạng audio
def detect_audio_format(file_path):
    try:
        with av.open(file_path) as container:
            # Lấy định dạng từ thông tin container
            format_name = container.format.name
            logger.info(f"Định dạng được phát hiện: {format_name}")
            return format_name
    except Exception as e:
        logger.warning(f"Không thể phát hiện định dạng audio thông qua av: {e}")
        # Thử dùng mimetypes
        mime_type, _ = mimetypes.guess_type(file_path)
        if mime_type and mime_type.startswith('audio/'):
            logger.info(f"Định dạng MIME được phát hiện: {mime_type}")
            return mime_type.split('/')[-1]
        return None

def load_asr_model():
    global asr_model, model_device, model_compute_type
    
    use_cuda_env = os.getenv("USE_CUDA", "true").lower() == "true"
    if use_cuda_env and torch.cuda.is_available():
        logger.info("Phát hiện NVIDIA CUDA GPU. Sử dụng GPU cho CTranslate2.")
        model_device = "cuda"
        model_compute_type = "float16" # float16 cho GPU CT2
    else:
        logger.info("Sử dụng CPU cho CTranslate2. Tối ưu cho xử lý đa luồng.")
        model_device = "cpu"
        model_compute_type = "int8" # int8 cho CPU CT2 là tốt nhất
    
    logger.info(f"Kiểm tra mô hình CTranslate2 tại: {MODEL_PATH_CT2}")
    if os.path.exists(MODEL_PATH_CT2) and os.path.exists(os.path.join(MODEL_PATH_CT2, "model.bin")):
        try:
            logger.info(f"Bắt đầu tải mô hình CTranslate2 từ: {MODEL_PATH_CT2}")
            start_time = time.time()
            
            cpu_threads = int(os.getenv("OMP_NUM_THREADS", os.cpu_count() or 4))
            # Đảm bảo num_workers không vượt quá cpu_threads khi dùng CPU
            num_workers_ct2 = min(MAX_WORKERS, cpu_threads) if model_device == "cpu" else MAX_WORKERS

            # Thiết lập beam size cho CTranslate2
            beam_size = int(os.getenv("BEAM_SIZE", 5))  # Giảm beam size để tăng tốc

            # Bật low_memory_mode để tiết kiệm VRAM khi dùng GPU
            low_memory = model_device == "cuda" and os.getenv("LOW_MEMORY", "true").lower() == "true"

            asr_model = WhisperModel(
                MODEL_PATH_CT2, 
                device=model_device, 
                compute_type=model_compute_type,
                cpu_threads=cpu_threads,
                num_workers=num_workers_ct2,
                local_files_only=True,
                download_root=MODEL_PATH_CT2,
                beam_size=beam_size,
                low_memory=low_memory,  # Thêm tham số low_memory
            )
            # Nếu muốn tối ưu hơn nữa với torch.compile (PyTorch 2.0+), hãy thử:
            # try:
            #     asr_model.model = torch.compile(asr_model.model)
            # except Exception:
            #     pass  # Không phải model nào cũng tương thích torch.compile
            end_time = time.time()
            logger.info(f"Đã tải mô hình CTranslate2 thành công trong {end_time - start_time:.2f} giây.")
            logger.info(f"Cấu hình CTranslate2: device='{model_device}', compute_type='{model_compute_type}', cpu_threads={cpu_threads}, num_workers={num_workers_ct2}, beam_size={beam_size}, low_memory={low_memory}")
            return
        except Exception as e:
            logger.error(f"LỖI NGHIÊM TRỌNG khi tải mô hình CTranslate2: {e}")
            logger.error(traceback.format_exc())
            asr_model = None # Đảm bảo model là None nếu không tải được
            raise RuntimeError(f"Không thể tải mô hình CTranslate2 từ {MODEL_PATH_CT2}. Dịch vụ ASR sẽ không hoạt động. Lỗi: {e}")
    else:
        logger.error(f"LỖI NGHIÊM TRỌNG: Không tìm thấy mô hình CTranslate2 tại {MODEL_PATH_CT2} hoặc file model.bin không tồn tại.")
        asr_model = None
        raise RuntimeError(f"Không tìm thấy mô hình CTranslate2 tại {MODEL_PATH_CT2}. Dịch vụ ASR sẽ không hoạt động.")

# Tải model khi ứng dụng khởi động
try:
    load_asr_model()
except RuntimeError as e:
    logger.error(f"ASR Service không thể khởi động do lỗi model: {e}")
    # asr_model sẽ là None, health check sẽ báo lỗi

@app.route('/health', methods=['GET'])
def health_check():
    if asr_model:
        return jsonify({
            "status": "ok", 
            "message": "ASR service is running with CTranslate2 model", 
            "model_loaded": True, 
            "model_type": "CTranslate2",
            "device": model_device,
            "compute_type": model_compute_type,
            "max_workers": MAX_WORKERS,
            "faster_whisper_version": faster_whisper_version
        }), 200
    else:
        return jsonify({
            "status": "error", 
            "message": "ASR service is running, BUT CTranslate2 MODEL FAILED TO LOAD.", 
            "model_loaded": False
        }), 500

def convert_audio_to_wav(input_path):
    """Chuyển đổi audio sang định dạng WAV sử dụng ffmpeg"""
    try:
        output_path = input_path + ".wav"
        logger.info(f"=== DEBUG: Đang chuyển đổi {input_path} sang {output_path} ===")
        
        # Kiểm tra xem ffmpeg có tồn tại không
        try:
            subprocess.run(["ffmpeg", "-version"], capture_output=True, check=True)
        except (subprocess.SubprocessError, FileNotFoundError):
            logger.warning("=== DEBUG: ffmpeg không khả dụng, sử dụng PyAV để chuyển đổi ===")
            # Sử dụng PyAV để chuyển đổi nếu không có ffmpeg
            try:
                with av.open(input_path) as input_container:
                    input_stream = input_container.streams.audio[0]
                    with av.open(output_path, 'w', 'wav') as output_container:
                        output_stream = output_container.add_stream('pcm_s16le', rate=input_stream.sample_rate)
                        output_stream.channels = input_stream.channels
                        for frame in input_container.decode(input_stream):
                            for packet in output_stream.encode(frame):
                                output_container.mux(packet)
                        # Flush encoder
                        for packet in output_stream.encode(None):
                            output_container.mux(packet)
                logger.info(f"=== DEBUG: Chuyển đổi thành công bằng PyAV ===")
                return output_path
            except Exception as e:
                logger.error(f"=== DEBUG: Lỗi khi chuyển đổi bằng PyAV: {e} ===")
                return input_path
        
        # Sử dụng ffmpeg để chuyển đổi
        cmd = [
            "ffmpeg", "-y", "-i", input_path, 
            "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            output_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            logger.error(f"=== DEBUG: Lỗi khi chuyển đổi audio: {result.stderr} ===")
            return input_path
            
        logger.info(f"=== DEBUG: Chuyển đổi thành công: {output_path} ===")
        return output_path
    except Exception as e:
        logger.error(f"=== DEBUG: Lỗi không xác định khi chuyển đổi audio: {e} ===")
        return input_path

def process_audio_ct2(audio_path, lang_detect=None, initial_prompt=None, session_id=None):
    """Xử lý audio bằng CTranslate2 model"""
    if not asr_model:
        logger.error("process_audio_ct2 được gọi nhưng model CTranslate2 không được tải.")
        return {"error": "CTranslate2 model not available"}
    try:
        logger.info(f"=== DEBUG: Bắt đầu xử lý audio {audio_path} ===")
        logger.info(f"=== DEBUG: Tham số: lang={lang_detect}, prompt={initial_prompt} ===")
        
        # Kiểm tra định dạng audio trước khi xử lý
        audio_format = detect_audio_format(audio_path)
        if audio_format:
            logger.info(f"=== DEBUG: Định dạng audio được phát hiện: {audio_format} ===")
        
        # Chuyển đổi sang WAV nếu cần
        original_path = audio_path
        converted_path = None
        if audio_format and "webm" in audio_format:
            converted_path = convert_audio_to_wav(audio_path)
            audio_path = converted_path
            logger.info(f"=== DEBUG: Đã chuyển đổi sang WAV: {audio_path} ===")
            
        # Xử lý đặc biệt cho tiếng Việt
        language_for_model = None  # Mặc định là tự phát hiện
        if lang_detect == "vi":
            language_for_model = "vi"  # Đặt rõ ngôn ngữ là tiếng Việt
            if not initial_prompt:
                initial_prompt = "Xin chào. Đây là hệ thống nhận dạng tiếng Việt."
                logger.info(f"=== DEBUG: Đã thêm initial_prompt tiếng Việt: {initial_prompt} ===")
        
        # Lấy streaming state từ cache nếu có
        streaming_state = None
        if session_id and session_id in streaming_state_cache:
            streaming_state = streaming_state_cache[session_id]
            logger.info(f"=== DEBUG: Sử dụng streaming state từ cache cho session {session_id} ===")
        
        # Ghi log các tham số chính của faster-whisper cho real-time optimization
        beam_size = int(os.getenv("BEAM_SIZE", 1))  # Giảm xuống 1 cho real-time speed
        vad_filter = os.getenv("VAD_FILTER", "false").lower() == "true"  # Tắt VAD filter để tránh bỏ sót âm thanh
        chunk_length = min(15, float(os.getenv("CHUNK_LENGTH", 3)))  # Giảm chunk length cho real-time (3 giây)
        
        logger.info(f"=== DEBUG: Gọi transcribe với: beam_size={beam_size}, language={language_for_model}, initial_prompt={initial_prompt}, vad_filter={vad_filter}, chunk_length={chunk_length} (real-time optimized) ===")
        
        # Transcribe với tham số tối ưu cho real-time
        segments, info = asr_model.transcribe(
            audio_path,
            beam_size=beam_size,
            language=language_for_model,
            initial_prompt=initial_prompt,
            vad_filter=vad_filter,
            vad_parameters={"min_silence_duration_ms": 200} if vad_filter else None,  # Giảm xuống 200ms
            word_timestamps=False,  # Không cần timestamp từng từ để tăng tốc
            no_repeat_ngram_size=1,  # Giảm xuống 1 để tăng tốc
            condition_on_previous_text=session_id is not None,  # Điều kiện trên văn bản trước đó nếu có session
            patience=0.5,  # Giảm patience cho real-time response
            temperature=0.0,  # Đặt về 0 để deterministic và nhanh hơn
        )
        
        # Lưu session info vào cache nếu có session_id (bỏ streaming_state vì không được hỗ trợ)
        if session_id and info.language_probability > 0.5:
            # Chỉ lưu thông tin cơ bản thay vì streaming_state
            streaming_state_cache[session_id] = {
                'language': info.language,
                'language_probability': info.language_probability
            }
            logger.info(f"=== DEBUG: Đã lưu session info cho session {session_id} ===")
        
        # Xử lý kết quả
        transcript = ""
        segments_data = []
        
        # Lưu các segment vào mảng để xử lý
        for segment in segments:
            segments_data.append({
                "id": segment.id,
                "text": segment.text.strip(),
                "start": segment.start,
                "end": segment.end
            })
            transcript += segment.text + " "
            
        # Xóa file tạm nếu đã chuyển đổi
        if converted_path and os.path.exists(converted_path):
            try:
                os.remove(converted_path)
                logger.info(f"=== DEBUG: Đã xóa file tạm: {converted_path} ===")
            except Exception as e:
                logger.warning(f"=== DEBUG: Không thể xóa file tạm {converted_path}: {e} ===")
        
        # Nếu không nhận dạng được gì, log warning và kiểm tra lý do
        if not transcript.strip():
            logger.warning(f"=== WARNING: Không nhận dạng được text từ audio file {audio_path} ===")
            # Kiểm tra file size để debug
            try:
                file_size = os.path.getsize(audio_path)
                logger.warning(f"=== DEBUG: Audio file size: {file_size} bytes ===")
                if file_size < 1000:  # Nếu file quá nhỏ
                    logger.warning(f"=== DEBUG: Audio file quá nhỏ, có thể không có âm thanh ===")
            except Exception as e:
                logger.warning(f"=== DEBUG: Không thể kiểm tra size của file: {e} ===")
        
        return {
            "text": transcript.strip(),
            "language": info.language,
            "language_probability": info.language_probability,
            "segments": segments_data,
            "processing_time": time.time() - info.transcription_start
        }
    
    except Exception as e:
        logger.error(f"=== ERROR: Lỗi khi xử lý audio: {e} ===")
        logger.error(traceback.format_exc())
        return {"error": str(e)}

# Thêm hàm mới để xử lý liên tục mà không cần xóa buffer
def recognizeSpeechWithoutClear(audio_path, lang="vi", prompt=None, session_id=None):
    """Nhận dạng giọng nói từ file audio nhưng giữ lại trạng thái streaming"""
    result = process_audio_ct2(audio_path, lang_detect=lang, initial_prompt=prompt, session_id=session_id)
    return result

@app.route('/recognize', methods=['POST'])
def recognize_audio():
    """API endpoint để nhận dạng giọng nói từ file audio"""
    start_time = time.time()
    
    # Kiểm tra xem có file được gửi lên không
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
    
    audio_file = request.files['audio']
    if audio_file.filename == '':
        return jsonify({"error": "Empty filename"}), 400
    
    # Thông số nhận dạng
    lang = request.form.get('language', 'vi')
    prompt = request.form.get('prompt', None)
    session_id = request.form.get('session_id', None)
    continuous = request.form.get('continuous', 'false').lower() == 'true'
    
    # Lưu file tạm thời
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_file.filename)[1]) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name
    
    try:
        # Xử lý nhận dạng giọng nói
        if continuous and session_id:
            result = recognizeSpeechWithoutClear(tmp_path, lang, prompt, session_id)
        else:
            result = process_audio_ct2(tmp_path, lang_detect=lang, initial_prompt=prompt)
        
        # Xóa file tạm sau khi xử lý
        try:
            os.unlink(tmp_path)
        except Exception as e:
            logger.warning(f"Không thể xóa file tạm {tmp_path}: {e}")
        
        # Thêm thời gian xử lý API 
        total_time = time.time() - start_time
        if isinstance(result, dict) and "error" not in result:
            result["api_processing_time"] = total_time
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Lỗi khi xử lý request: {e}")
        logger.error(traceback.format_exc())
        
        # Xóa file tạm trong trường hợp lỗi
        try:
            os.unlink(tmp_path)
        except:
            pass
            
        return jsonify({"error": str(e)}), 500

@app.route('/recognize_simple', methods=['POST'])
def recognize_audio_simple():
    """API endpoint đơn giản hơn để nhận dạng giọng nói từ file audio"""
    start_time = time.time()
    
    # Kiểm tra xem có file được gửi lên không
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
    
    audio_file = request.files['audio']
    if audio_file.filename == '':
        return jsonify({"error": "Empty filename"}), 400
    
    # Thông số nhận dạng
    lang = request.form.get('language', 'vi')
    
    # Lưu file tạm thời
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_file.filename)[1]) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name
    
    try:
        # Xử lý nhận dạng giọng nói đơn giản
        result = process_audio_ct2(tmp_path, lang_detect=lang)
        
        # Xóa file tạm sau khi xử lý
        try:
            os.unlink(tmp_path)
        except Exception as e:
            logger.warning(f"Không thể xóa file tạm {tmp_path}: {e}")
        
        # Trả về kết quả đơn giản hơn
        if "error" in result:
            return jsonify({"error": result["error"]}), 500
        
        simple_result = {
            "text": result["text"],
            "language": result["language"],
            "processing_time": time.time() - start_time
        }
        
        return jsonify(simple_result)
    
    except Exception as e:
        logger.error(f"Lỗi khi xử lý request đơn giản: {e}")
        logger.error(traceback.format_exc())
        
        # Xóa file tạm trong trường hợp lỗi
        try:
            os.unlink(tmp_path)
        except:
            pass
            
        return jsonify({"error": str(e)}), 500

# Thêm API endpoint mới cho streaming
@app.route('/recognize_stream', methods=['POST'])
def recognize_stream():
    """API endpoint cho streaming recognition"""
    start_time = time.time()
    
    # Kiểm tra xem có file được gửi lên không
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400
    
    audio_file = request.files['audio']
    if audio_file.filename == '':
        return jsonify({"error": "Empty filename"}), 400
    
    # Thông số nhận dạng
    lang = request.form.get('language', 'vi')
    prompt = request.form.get('prompt', None)
    session_id = request.form.get('session_id')
    
    # Session ID là bắt buộc cho streaming
    if not session_id:
        return jsonify({"error": "Session ID is required for streaming"}), 400
    
    # Lưu file tạm thời
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(audio_file.filename)[1]) as tmp:
        audio_file.save(tmp.name)
        tmp_path = tmp.name
    
    try:
        # Xử lý streaming
        result = recognizeSpeechWithoutClear(tmp_path, lang, prompt, session_id)
        
        # Xóa file tạm sau khi xử lý
        try:
            os.unlink(tmp_path)
        except Exception as e:
            logger.warning(f"Không thể xóa file tạm {tmp_path}: {e}")
        
        # Thêm thời gian xử lý API 
        total_time = time.time() - start_time
        if isinstance(result, dict) and "error" not in result:
            result["api_processing_time"] = total_time
        
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Lỗi khi xử lý streaming: {e}")
        logger.error(traceback.format_exc())
        
        # Xóa file tạm trong trường hợp lỗi
        try:
            os.unlink(tmp_path)
        except:
            pass
            
        return jsonify({"error": str(e)}), 500

@app.route('/clear_session', methods=['POST'])
def clear_session():
    """Xóa trạng thái streaming cho một session"""
    data = request.get_json()
    
    if not data or 'session_id' not in data:
        return jsonify({"error": "Session ID is required"}), 400
    
    session_id = data['session_id']
    
    if session_id in streaming_state_cache:
        del streaming_state_cache[session_id]
        return jsonify({"success": True, "message": f"Session {session_id} cleared"})
    else:
        return jsonify({"success": False, "message": f"Session {session_id} not found"}), 404

if __name__ == '__main__':
    logger.info(f"Starting ASR service (CTranslate2 ONLY) on port {PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=False) 
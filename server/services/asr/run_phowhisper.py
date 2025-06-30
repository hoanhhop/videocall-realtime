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
MODEL_PATH_CT2 = os.getenv("MODEL_PATH_CT2", os.path.join(PROJECT_ROOT, "server", "models", "phowhisper", "PhoWhisper-base-ct2"))
# MODEL_PATH_HF = os.getenv("MODEL_PATH_HF", os.path.join(PROJECT_ROOT, "server", "models", "phowhisper", "PhoWhisper-base")) # Không dùng HF nữa

asr_model = None
model_device = "cpu"
model_compute_type = "int8" # int8 cho CPU CT2 là tốt nhất
MAX_WORKERS = int(os.getenv("MAX_WORKERS", 4))
executor = ThreadPoolExecutor(max_workers=MAX_WORKERS)
token_buffer = {}

# Đọc cổng từ biến môi trường, mặc định là 50051
PORT = int(os.getenv("PORT_ASR", 50051))

# In ra phiên bản của faster-whisper để debug
faster_whisper_version = pkg_resources.get_distribution("faster-whisper").version
print(f"Faster Whisper version: {faster_whisper_version}")

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

            asr_model = WhisperModel(
                MODEL_PATH_CT2, 
                device=model_device, 
                compute_type=model_compute_type,
                cpu_threads=cpu_threads,
                num_workers=num_workers_ct2,
                local_files_only=True,  # Thêm option này để đảm bảo chỉ sử dụng file cục bộ
                download_root=MODEL_PATH_CT2  # Thêm đường dẫn download root
            )
            end_time = time.time()
            logger.info(f"Đã tải mô hình CTranslate2 thành công trong {end_time - start_time:.2f} giây.")
            logger.info(f"Cấu hình CTranslate2: device='{model_device}', compute_type='{model_compute_type}', cpu_threads={cpu_threads}, num_workers={num_workers_ct2}")
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
            "max_workers": MAX_WORKERS
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
            
        # In thêm thông tin chi tiết về audio
        try:
            with av.open(audio_path) as container:
                for stream in container.streams:
                    if stream.type == 'audio':
                        logger.info(f"=== DEBUG AUDIO: Sample_rate={stream.sample_rate}, channels={stream.channels}, codec={stream.codec_context.name} ===")
                        frame_count = 0
                        # Ghi file debug
                        debug_audio_path = original_path + "_debug.raw"
                        logger.info(f"=== DEBUG: Ghi audio đã xử lý vào: {debug_audio_path} ===")
                        with open(debug_audio_path, 'wb') as f_debug:
                            for frame in container.decode(stream):
                                frame_count += 1
                                if hasattr(frame, 'to_ndarray'):
                                    f_debug.write(frame.to_ndarray().tobytes())
                                if frame_count > 500: # Tăng số lượng frame đọc để debug
                                    break
                        logger.info(f"=== DEBUG AUDIO: Đọc được {frame_count} frames ===")
        except Exception as e:
            logger.error(f"=== DEBUG AUDIO ERROR: Không thể đọc thông tin audio chi tiết: {e} ===")
            logger.error(traceback.format_exc())
        
        # Thêm try-except chi tiết để bắt đúng lỗi duration_after_padding
        try:
            # Ghi log các tham số chính của faster-whisper
            logger.info(f"=== DEBUG: Gọi transcribe với: beam_size=10, language={language_for_model}, initial_prompt={initial_prompt}, vad_filter=False ===")
            
            segments, info = asr_model.transcribe(
                audio_path,
                beam_size=10, # Tăng beam_size lớn hơn để tăng khả năng nhận dạng
                language=language_for_model,  # Sử dụng biến language_for_model đã xử lý ở trên
                initial_prompt=initial_prompt,
                vad_filter=False, # Tắt VAD filter để thử
                word_timestamps=False # Tắt nếu không cần thiết để tăng tốc
            )
            
            logger.info(f"=== DEBUG: Transcribe thành công, info=TranscriptionInfo(language={info.language}, language_probability={info.language_probability}) ===")
        except AttributeError as attr_err:
            if "duration_after_padding" in str(attr_err):
                logger.error(f"=== DEBUG: Lỗi duration_after_padding cụ thể: {attr_err} ===")
                logger.error(f"=== DEBUG: Stack trace: {traceback.format_exc()} ===")
                # Trả về lỗi cụ thể hơn 
                return {"error": f"Lỗi AttributeError: {attr_err} - Có thể do mô hình không tương thích với phiên bản faster-whisper"}
            else:
                # Re-raise nếu là AttributeError khác
                raise attr_err

        # Chuyển đổi segments thành list để có thể dễ dàng kiểm tra và sử dụng
        segments_list = list(segments)
        logger.info(f"=== DEBUG: Đã nhận được {len(segments_list)} segments ===")
        
        result_segments = []
        recognized_text = ""
        
        # Xử lý các phân đoạn
        current_tokens_for_buffer = []
        
        # In ra các phân đoạn một cách chi tiết để debug
        for i, segment in enumerate(segments_list):
            segment_text = segment.text.strip()
            logger.info(f"=== DEBUG: Segment {i}: '{segment_text}', start={segment.start}, end={segment.end} ===")
            recognized_text += segment_text + " "
            result_segments.append({
                "text": segment_text,
                "start": segment.start,
                "end": segment.end,
                "probability": segment.avg_logprob if hasattr(segment, 'avg_logprob') else 0.0
            })
            
        # Nếu không có text được nhận dạng, kiểm tra xem có đúng là không có, hay là model không nhận ra tiếng Việt
        if recognized_text.strip() == "":
            logger.warning("=== DEBUG: Không nhận dạng được văn bản nào. Có thể audio không có tiếng nói hoặc mô hình không hỗ trợ tiếng Việt ===")
            # Đây là một trường hợp đặc biệt, bạn có thể thêm các xử lý riêng ở đây

        logger.info(f"=== DEBUG: Kết quả nhận dạng: '{recognized_text}' ===")
        
        # Xóa file tạm đã chuyển đổi nếu có
        if converted_path and os.path.exists(converted_path) and converted_path != original_path:
            try:
                os.unlink(converted_path)
                logger.info(f"=== DEBUG: Đã xóa file tạm đã chuyển đổi: {converted_path} ===")
            except Exception as e:
                logger.warning(f"=== DEBUG: Không thể xóa file tạm đã chuyển đổi: {e} ===")
        
        return {
            "text": recognized_text.strip(),
            "segments": result_segments,
            "detected_language": info.language,
            "language_probability": float(info.language_probability),
            "processing_time_ms": info.duration * 1000, # Đây là duration của audio, không phải thời gian xử lý
            "transcription_time": getattr(info, "transcription_time", None) # Thời gian thực tế để transcribe
        }
    except Exception as e:
        # Xóa file tạm đã chuyển đổi trong trường hợp có lỗi
        if converted_path and os.path.exists(converted_path) and converted_path != original_path:
            try:
                os.unlink(converted_path)
                logger.info(f"=== DEBUG: Đã xóa file tạm đã chuyển đổi: {converted_path} ===")
            except Exception as e_clean:
                logger.warning(f"=== DEBUG: Không thể xóa file tạm đã chuyển đổi: {e_clean} ===")
                
        logger.error(f"Lỗi xử lý audio với CT2: {e}")
        logger.error(f"=== DEBUG: Chi tiết lỗi: {str(e)} ===")
        logger.error(f"=== DEBUG: Loại lỗi: {type(e).__name__} ===")
        logger.error(traceback.format_exc())
        return {"error": str(e)}

@app.route('/recognize', methods=['POST'])
def recognize_audio():
    if not asr_model:
        logger.error("Yêu cầu nhận dạng không thành công do model CTranslate2 chưa được tải.")
        return jsonify({"error": "CTranslate2 Model not loaded"}), 500

    if 'audio_file' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files['audio_file']
    if audio_file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        logger.info("=== DEBUG: Xử lý yêu cầu recognize_audio ===")
        
        # Bảo tồn phần mở rộng tệp tin gốc
        original_filename = audio_file.filename
        file_ext = os.path.splitext(original_filename)[1].lower()
        
        # Sử dụng phần mở rộng đúng với nội dung, mặc định .webm vì client thường gửi audio/webm
        if not file_ext or file_ext == '.wav':
            # Nếu không có phần mở rộng hoặc là .wav (có thể là audio/webm được gán sai tên),
            # kiểm tra Content-Type
            content_type = audio_file.content_type
            if content_type == 'audio/webm':
                file_ext = '.webm'
            elif content_type == 'audio/mp3' or content_type == 'audio/mpeg':
                file_ext = '.mp3'
            elif content_type == 'audio/ogg':
                file_ext = '.ogg'
            else:
                # Giữ nguyên .wav nếu không rõ
                file_ext = '.wav'
        
        logger.info(f"=== DEBUG: Chuẩn bị lưu audio với phần mở rộng: {file_ext} ===")
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_audio_file:
            audio_path = tmp_audio_file.name
            audio_file.save(audio_path)
            
            lang_detect = request.form.get("language", None)
            initial_prompt_text = request.form.get("initial_prompt", None)
            session_id = request.form.get("session_id", None)
            
            logger.info(f"=== DEBUG: Đã lưu file audio tạm thời tại {audio_path} ===")
            logger.info(f"=== DEBUG: Tham số HTTP: language={lang_detect}, initial_prompt={initial_prompt_text}, session_id={session_id} ===")
            
            start_time_transcribe = time.time()
            # Gọi trực tiếp process_audio_ct2
            result = process_audio_ct2(audio_path, lang_detect, initial_prompt_text, session_id)
            actual_transcription_time = time.time() - start_time_transcribe
            
            try:
                os.unlink(audio_path)
                logger.info(f"=== DEBUG: Đã xóa file tạm {audio_path} ===")
            except Exception as e_unlink:
                logger.warning(f"Không thể xóa file tạm: {e_unlink}")
            
            if "error" in result:
                logger.error(f"=== DEBUG: Trả về lỗi: {result['error']} ===")
                return jsonify({"error": result["error"]}), 500
                
            logger.info(f"Nhận dạng CT2 thành công trong {actual_transcription_time:.2f}s. Ngôn ngữ: {result.get('detected_language','N/A')}")
            result["actual_server_processing_time"] = actual_transcription_time
            logger.info(f"=== DEBUG: Trả về kết quả thành công: {result['text'][:50]}... ===")
            return jsonify(result)

    except Exception as e:
        logger.error(f"Lỗi trong quá trình nhận dạng: {e}", exc_info=True)
        logger.error(f"=== DEBUG: Lỗi ngoại lệ: {str(e)} ===")
        return jsonify({"error": str(e)}), 500

# Thêm endpoint mới: recognize_simple - API đơn giản hơn
@app.route('/recognize_simple', methods=['POST'])
def recognize_audio_simple():
    """Endpoint đơn giản hơn để nhận dạng giọng nói"""
    if not asr_model:
        logger.error("Yêu cầu nhận dạng đơn giản không thành công do model CTranslate2 chưa được tải.")
        return jsonify({"error": "CTranslate2 Model not loaded"}), 500

    if 'audio_file' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files['audio_file']
    if audio_file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        logger.info("=== DEBUG: Xử lý yêu cầu recognize_audio_simple ===")
        
        # Bảo tồn phần mở rộng tệp tin gốc
        original_filename = audio_file.filename
        file_ext = os.path.splitext(original_filename)[1].lower()
        
        # Sử dụng phần mở rộng đúng với nội dung, mặc định .webm vì client thường gửi audio/webm
        if not file_ext or file_ext == '.wav':
            content_type = audio_file.content_type
            if content_type == 'audio/webm':
                file_ext = '.webm'
            elif content_type == 'audio/mp3' or content_type == 'audio/mpeg':
                file_ext = '.mp3'
            elif content_type == 'audio/ogg':
                file_ext = '.ogg'
            else:
                file_ext = '.wav'
        
        logger.info(f"=== DEBUG: [SIMPLE] Chuẩn bị lưu audio với phần mở rộng: {file_ext} ===")
        
        with tempfile.NamedTemporaryFile(delete=False, suffix=file_ext) as tmp_audio_file:
            audio_path = tmp_audio_file.name
            audio_file.save(audio_path)
            
            lang_detect = request.form.get("language", None)
            initial_prompt_text = request.form.get("initial_prompt", None)
            
            logger.info(f"=== DEBUG: [SIMPLE] Đã lưu file audio tạm thời tại {audio_path} ===")
            logger.info(f"=== DEBUG: [SIMPLE] Tham số HTTP: language={lang_detect}, initial_prompt={initial_prompt_text} ===")
            
            # Đơn giản hóa kết quả, chỉ trả về văn bản và ngôn ngữ
            start_time = time.time()
            result = process_audio_ct2(audio_path, lang_detect, initial_prompt_text)
            processing_time = time.time() - start_time
            
            try:
                os.unlink(audio_path)
                logger.info(f"=== DEBUG: [SIMPLE] Đã xóa file tạm {audio_path} ===")
            except Exception as e_unlink:
                logger.warning(f"[SIMPLE] Không thể xóa file tạm: {e_unlink}")
            
            if "error" in result:
                logger.error(f"=== DEBUG: [SIMPLE] Trả về lỗi: {result['error']} ===")
                return jsonify({"error": result["error"]}), 500
            
            # Kết quả đơn giản hơn
            simple_result = {
                "text": result.get("text", ""),
                "language": result.get("detected_language", lang_detect or "unknown"),
                "language_probability": result.get("language_probability", 0.0),
                "processing_time_ms": int(processing_time * 1000)
            }
            
            logger.info(f"[SIMPLE] Nhận dạng thành công: {simple_result['text'][:50]}...")
            return jsonify(simple_result)
            
    except Exception as e:
        logger.error(f"[SIMPLE] Lỗi trong quá trình nhận dạng đơn giản: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    logger.info(f"Starting ASR service (CTranslate2 ONLY) on port {PORT}")
    app.run(host='0.0.0.0', port=PORT, debug=False) 
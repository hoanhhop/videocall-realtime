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
        with av.open(file_path, metadata_errors="ignore") as container:
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

def validate_and_fix_audio(input_path):
    """Xác thực và sửa file audio nếu cần thiết"""
    try:
        # Kiểm tra file size
        file_size = os.path.getsize(input_path)
        if file_size < 100:  # File quá nhỏ
            logger.warning(f"File audio quá nhỏ ({file_size} bytes), có thể bị lỗi")
            return None
            
        # Thử đọc file header để kiểm tra định dạng
        with open(input_path, 'rb') as f:
            header = f.read(12)
            
        # Kiểm tra các định dạng phổ biến
        if header.startswith(b'RIFF') and header[8:12] == b'WAVE':
            logger.info("Phát hiện định dạng WAV")
            return validate_wav_file(input_path)
        elif header.startswith(b'OggS'):
            logger.info("Phát hiện định dạng OGG")
            return convert_to_standard_wav(input_path)
        elif b'webm' in header.lower() or b'vp8' in header.lower():
            logger.info("Phát hiện định dạng WebM")
            return convert_to_standard_wav(input_path)
        else:
            logger.warning(f"Định dạng không xác định, header: {header[:8].hex()}")
            return convert_to_standard_wav(input_path)
            
    except Exception as e:
        logger.error(f"Lỗi khi xác thực audio: {e}")
        return None

def validate_wav_file(wav_path):
    """Xác thực file WAV và sửa lỗi nếu có"""
    try:
        # Thử mở với PyAV trước
        with av.open(wav_path, metadata_errors="ignore") as container:
            if container.streams.audio:
                logger.info("File WAV hợp lệ")
                return wav_path
    except Exception as e:
        logger.warning(f"File WAV có vấn đề, thử chuyển đổi lại: {e}")
        return convert_to_standard_wav(wav_path)

def convert_to_standard_wav(input_path):
    """Chuyển đổi audio sang định dạng WAV chuẩn với multiple fallback methods"""
    try:
        output_path = input_path + "_fixed.wav"
        logger.info(f"Đang chuyển đổi {input_path} sang {output_path}")
        
        # Method 1: Thử với ffmpeg với các tùy chọn khôi phục
        cmd = [
            "ffmpeg", "-y", "-err_detect", "ignore_err", "-i", input_path,
            "-f", "wav", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            "-avoid_negative_ts", "make_zero", "-fflags", "+discardcorrupt",
            output_path
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        
        if result.returncode == 0 and os.path.exists(output_path):
            # Kiểm tra file output có hợp lệ không
            try:
                with av.open(output_path, metadata_errors="ignore") as container:
                    if container.streams.audio:
                        file_size = os.path.getsize(output_path)
                        logger.info(f"ffmpeg chuyển đổi thành công: {output_path} ({file_size} bytes)")
                        return output_path
            except Exception as e:
                logger.warning(f"ffmpeg output validation failed: {e}")
                
        logger.warning(f"ffmpeg method failed: {result.stderr}")
        
        # Method 2: Thử ffmpeg với raw input interpretation
        cmd2 = [
            "ffmpeg", "-y", "-f", "s16le", "-ar", "16000", "-ac", "1", "-i", input_path,
            "-f", "wav", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            output_path + "_raw"
        ]
        
        result2 = subprocess.run(cmd2, capture_output=True, text=True, timeout=30)
        if result2.returncode == 0 and os.path.exists(output_path + "_raw"):
            try:
                with av.open(output_path + "_raw", metadata_errors="ignore") as container:
                    if container.streams.audio:
                        logger.info(f"ffmpeg raw method thành công: {output_path}_raw")
                        return output_path + "_raw"
            except:
                pass
        
        # Method 3: Nếu ffmpeg thất bại, thử với PyAV
        pyav_result = convert_with_pyav(input_path)
        if pyav_result:
            return pyav_result
        
        # Method 4: Tạo WAV header mới cho raw data
        return create_wav_from_raw(input_path)
        
    except Exception as e:
        logger.error(f"Lỗi khi chuyển đổi audio: {e}")
        return None

def create_wav_from_raw(input_path):
    """Tạo file WAV với header chuẩn từ raw audio data"""
    try:
        output_path = input_path + "_manual.wav"
        
        # Đọc raw data
        with open(input_path, 'rb') as f:
            raw_data = f.read()
        
        # Tạo WAV header chuẩn (16-bit, mono, 16kHz)
        sample_rate = 16000
        channels = 1
        bits_per_sample = 16
        byte_rate = sample_rate * channels * bits_per_sample // 8
        block_align = channels * bits_per_sample // 8
        data_size = len(raw_data)
        
        # WAV header
        header = b'RIFF'
        header += (36 + data_size).to_bytes(4, 'little')  # Chunk size
        header += b'WAVE'
        header += b'fmt '
        header += (16).to_bytes(4, 'little')  # Subchunk1 size
        header += (1).to_bytes(2, 'little')   # Audio format (PCM)
        header += channels.to_bytes(2, 'little')
        header += sample_rate.to_bytes(4, 'little')
        header += byte_rate.to_bytes(4, 'little')
        header += block_align.to_bytes(2, 'little')
        header += bits_per_sample.to_bytes(2, 'little')
        header += b'data'
        header += data_size.to_bytes(4, 'little')
        
        # Ghi file WAV hoàn chỉnh
        with open(output_path, 'wb') as f:
            f.write(header)
            f.write(raw_data)
        
        # Kiểm tra kết quả
        try:
            with av.open(output_path, metadata_errors="ignore") as container:
                if container.streams.audio:
                    logger.info(f"Manual WAV creation thành công: {output_path}")
                    return output_path
        except Exception as e:
            logger.error(f"Manual WAV validation failed: {e}")
            
        return None
        
    except Exception as e:
        logger.error(f"Manual WAV creation failed: {e}")
        return None

def convert_with_pyav(input_path):
    """Chuyển đổi audio bằng PyAV với các tùy chọn khôi phục"""
    try:
        output_path = input_path + "_pyav_fixed.wav"
        
        # Thử mở với các tùy chọn khôi phục
        input_container = av.open(input_path, metadata_errors="ignore")
        
        with av.open(output_path, 'w', 'wav') as output_container:
            # Tìm stream audio
            input_stream = None
            for stream in input_container.streams:
                if stream.type == 'audio':
                    input_stream = stream
                    break
                    
            if not input_stream:
                logger.error("Không tìm thấy audio stream")
                return None
                
            # Tạo output stream
            output_stream = output_container.add_stream('pcm_s16le', rate=16000)
            output_stream.channels = 1
            
            # Copy audio data
            for frame in input_container.decode(input_stream):
                # Resample if needed
                if frame.sample_rate != 16000:
                    frame = frame.resample(16000)
                if frame.layout.channels.count != 1:
                    frame = frame.resample(layout='mono')
                    
                for packet in output_stream.encode(frame):
                    output_container.mux(packet)
            
            # Flush
            for packet in output_stream.encode(None):
                output_container.mux(packet)
                
        input_container.close()
        
        if os.path.exists(output_path):
            logger.info(f"PyAV chuyển đổi thành công: {output_path}")
            return output_path
        else:
            logger.error("PyAV conversion failed")
            return None
            
    except Exception as e:
        logger.error(f"PyAV conversion error: {e}")
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

            # FIXED: Removed beam_size and low_memory from constructor
            # These parameters should be passed to the transcribe method instead
            asr_model = WhisperModel(
                MODEL_PATH_CT2, 
                device=model_device, 
                compute_type=model_compute_type,
                cpu_threads=cpu_threads,
                local_files_only=True
            )
            # Nếu muốn tối ưu hơn nữa với torch.compile (PyTorch 2.0+), hãy thử:
            # try:
            #     asr_model.model = torch.compile(asr_model.model)
            # except Exception:
            #     pass  # Không phải model nào cũng tương thích torch.compile
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
    """Chuyển đổi audio sang định dạng WAV sử dụng ffmpeg hoặc PyAV với error handling"""
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
                with av.open(input_path, metadata_errors="ignore") as input_container:
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
        
        # Sử dụng ffmpeg để chuyển đổi với error handling
        cmd = [
            "ffmpeg", "-y", "-i", input_path, 
            "-f", "wav", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1",
            "-avoid_negative_ts", "make_zero",
            output_path
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        
        if result.returncode != 0:
            logger.error(f"=== DEBUG: Lỗi khi chuyển đổi audio: {result.stderr} ===")
            return input_path
            
        logger.info(f"=== DEBUG: Chuyển đổi thành công: {output_path} ===")
        return output_path
    except Exception as e:
        logger.error(f"=== DEBUG: Lỗi không xác định khi chuyển đổi audio: {e} ===")
        return input_path

def process_audio_ct2(audio_path, lang_detect=None, initial_prompt=None, session_id=None):
    """Xử lý audio bằng CTranslate2 model với robust audio processing"""
    start_time = time.time()
    if not asr_model:
        logger.error("process_audio_ct2 được gọi nhưng model CTranslate2 không được tải.")
        return {"error": "CTranslate2 model not available"}
    
    original_path = audio_path
    processed_path = None
    
    try:
        logger.info(f"=== DEBUG: Bắt đầu xử lý audio {audio_path} ===")
        logger.info(f"=== DEBUG: Tham số: lang={lang_detect}, prompt={initial_prompt} ===")
        
        # Kiểm tra file size trước
        try:
            file_size = os.path.getsize(audio_path)
            logger.info(f"=== DEBUG: File size: {file_size} bytes ===")
            if file_size < 100:  # File quá nhỏ
                logger.error("File audio quá nhỏ, có thể bị lỗi")
                return {"error": "Audio file too small"}
        except Exception as e:
            logger.error(f"Không thể kiểm tra file size: {e}")
            return {"error": "Cannot access audio file"}
        
        # Bước 1: Xác thực và sửa file audio
        processed_path = validate_and_fix_audio(audio_path)
        if not processed_path:
            logger.error("Không thể xử lý file audio")
            return {"error": "Invalid audio file format"}
            
        if processed_path != audio_path:
            logger.info(f"=== DEBUG: Audio đã được sửa/chuyển đổi: {processed_path} ===")
            audio_path = processed_path
        
        # Bước 2: Kiểm tra lại file sau khi xử lý
        try:
            final_size = os.path.getsize(audio_path)
            logger.info(f"=== DEBUG: Final processed file size: {final_size} bytes ===")
        except Exception as e:
            logger.error(f"Processed file không tồn tại: {e}")
            return {"error": "Audio processing failed"}
        
        # Bước 3: Test PyAV compatibility trước khi gọi transcribe
        try:
            with av.open(audio_path, metadata_errors="ignore") as test_container:
                if not test_container.streams.audio:
                    logger.error("Không tìm thấy audio stream trong file")
                    return {"error": "No audio stream found"}
                audio_stream = test_container.streams.audio[0]
                logger.info(f"=== DEBUG: Audio stream OK - codec: {audio_stream.codec_context.name}, rate: {audio_stream.sample_rate} ===")
        except Exception as e:
            logger.error(f"File vẫn không tương thích với PyAV sau xử lý: {e}")
            # Thử chuyển đổi một lần nữa với ffmpeg
            final_fixed_path = convert_to_standard_wav(audio_path)
            if final_fixed_path and final_fixed_path != audio_path:
                logger.info(f"=== DEBUG: Thử chuyển đổi lần cuối: {final_fixed_path} ===")
                if processed_path and processed_path != original_path:
                    try:
                        os.unlink(processed_path)
                    except:
                        pass
                processed_path = final_fixed_path
                audio_path = final_fixed_path
            else:
                return {"error": f"Audio format incompatible: {str(e)}"}
        
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
        
        # Ghi log các tham số chính của faster-whisper
        beam_size = int(os.getenv("BEAM_SIZE", 5))
        vad_filter = os.getenv("VAD_FILTER", "false").lower() == "true"  # Tắt VAD filter để tránh bỏ sót âm thanh
        chunk_length = min(30, float(os.getenv("CHUNK_LENGTH", 5)))  # Chunk length in seconds
        
        logger.info(f"=== DEBUG: Gọi transcribe với: beam_size={beam_size}, language={language_for_model}, initial_prompt={initial_prompt}, vad_filter={vad_filter}, chunk_length={chunk_length} ===")
        
        # Transcribe với tham số tối ưu (bỏ streaming_state vì không được hỗ trợ)
        segments, info = asr_model.transcribe(
            audio_path,
            beam_size=beam_size,
            language=language_for_model,
            initial_prompt=initial_prompt,
            vad_filter=vad_filter,
            vad_parameters={"min_silence_duration_ms": 500} if vad_filter else None,
            word_timestamps=False,  # Không cần timestamp từng từ để tăng tốc
            no_repeat_ngram_size=2,  # Ngăn lặp lại
            condition_on_previous_text=session_id is not None,  # Điều kiện trên văn bản trước đó nếu có session
        )
        
        # Lưu session info vào cache nếu có session_id (bỏ streaming_state vì không được hỗ trợ)
        if session_id and info.language_probability > 0.5:
            # Chỉ lưu thông tin cơ bản thay vì streaming_state
            streaming_state_cache[session_id] = {
                'language': info.language,
                'language_probability': info.language_probability
            }
            logger.info(f"=== DEBUG: Đã lưu session info cho {session_id} ===")
        
        # Xử lý kết quả
        transcript = ""
        segments_data = []
        
        # Lưu các segment vào mảng để xử lý
        for segment in segments:
            segment_text = segment.text.strip()
            transcript += segment_text + " "
            segments_data.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment_text
            })
        
        # Dọn dẹp file tạm đã chuyển đổi
        if processed_path and processed_path != original_path and os.path.exists(processed_path):
            try:
                os.unlink(processed_path)
                logger.info(f"=== DEBUG: Đã xóa file tạm đã chuyển đổi: {processed_path} ===")
            except Exception as e:
                logger.warning(f"=== DEBUG: Không thể xóa file tạm đã chuyển đổi: {e} ===")
        
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
            "processing_time": time.time() - start_time
        }
    
    except Exception as e:
        # Dọn dẹp file tạm nếu có lỗi
        if processed_path and processed_path != original_path and os.path.exists(processed_path):
            try:
                os.unlink(processed_path)
                logger.info(f"=== DEBUG: Đã xóa file tạm do lỗi: {processed_path} ===")
            except Exception as e_clean:
                logger.warning(f"=== DEBUG: Không thể xóa file tạm: {e_clean} ===")
                
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
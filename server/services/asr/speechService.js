// server/services/speechService.js
const fs = require('fs').promises; // fs.promises có thể không cần nữa nếu không lưu file ở đây
const path = require('path');
const { createLogger } = require('../../utils/logger');
const { recognizeAudioViaHttp, recognizeAudioViaHttpSimple, recognizeAudioViaHttpStreaming, checkASRServiceHealth } = require('../../utils/phowhisperNodeClient');

const logger = createLogger('speech-service');

// Trạng thái kết nối đến ASR HTTP service
let isAsrServiceConnected = false;
let lastAsrConnectionAttempt = 0;
const ASR_CONNECTION_RETRY_INTERVAL = 5000; // Thử lại sau mỗi 5 giây

// Buffer lưu trữ audio chunk (vẫn cần cho việc tích lũy)
let audioBuffer = Buffer.alloc(0);

// Cấu hình xử lý âm thanh
const AUDIO_CONFIG = {
  maxFrameLength: 16000 * 10, // Tối đa 10 giây âm thanh (có thể điều chỉnh)
  minFrameLength: 16000 * 0.15, // Giảm xuống 0.15 giây cho real-time responsiveness
  sampleRate: 16000, // Giả định audio từ client là 16kHz
  // Thêm các cấu hình khác nếu cần, ví dụ: bitDepth: 16, channels: 1
};

/**
 * Load Model - Bây giờ là kiểm tra kết nối đến ASR HTTP Service
 */
const loadModel = async () => {
  logger.info("Kiểm tra kết nối đến PhoWhisper ASR HTTP service...");
  console.log("[HOP DEBUG] Kiểm tra kết nối ban đầu đến PhoWhisper ASR HTTP service...");
  
  const now = Date.now();
  if (isAsrServiceConnected || (now - lastAsrConnectionAttempt < ASR_CONNECTION_RETRY_INTERVAL)) {
    // Nếu đã kết nối, hoặc vừa thử kết nối gần đây, không thử lại ngay
    // console.log(`[HOP DEBUG] Bỏ qua kiểm tra ASR service vì trạng thái hiện tại hoặc thử gần đây.`);
    return isAsrServiceConnected;
  }

  lastAsrConnectionAttempt = now;
  isAsrServiceConnected = await checkASRServiceHealth();
  if (isAsrServiceConnected) {
    logger.info('Kết nối PhoWhisper ASR HTTP service thành công.');
    console.log('✅ [HOP DEBUG] Kết nối PhoWhisper ASR HTTP service thành công.');
  } else {
    logger.warn('Không thể kết nối đến PhoWhisper ASR HTTP service.');
    console.warn('⚠️ [HOP DEBUG] Không thể kết nối đến PhoWhisper ASR HTTP service.');
  }
  return isAsrServiceConnected;
};

/**
 * Xử lý kết quả nhận diện từ ASR HTTP service response
 */
const processAsrResponse = (response, languageRequested) => {
    if (!response || typeof response.text === 'undefined') {
        logger.warn('Phản hồi không hợp lệ hoặc không có text từ ASR service.');
        return { 
            text: '', 
            confidence: 0, 
            language: languageRequested || 'unknown', 
            isEmpty: true, 
            error: 'Invalid response from ASR service' 
        };
    }
    return {
        text: response.text || '',
        originalText: response.text || '', // Giữ lại để debug nếu cần
        confidence: response.language_probability || 0.0, // Sử dụng language_probability làm confidence
        language: response.detected_language || languageRequested || 'unknown',
        inferenceTime: response.processing_time_ms || 0,
        // audioDuration: response.audio_duration_s || 0, // Cần ASR service trả về cái này
        isEmpty: !response.text, // isEmpty nếu text rỗng
        // audioEnergy: response.audio_energy || 0, // Cần ASR service trả về
        timestamp: Date.now(),
        source: 'phowhisper-http-service',
    };
};

/**
 * Nhận diện giọng nói từ buffer audio qua ASR HTTP service
 * @param {Buffer} audioData - Buffer chứa dữ liệu âm thanh
 * @param {string} language - Ngôn ngữ (vi hoặc en, hoặc null để tự phát hiện)
 * @param {string} initialPrompt - Ngữ cảnh ban đầu (nếu có)
 * @returns {Promise<Object>} Kết quả nhận diện
 */
async function recognizeSpeech(audioData, language = null, initialPrompt = null) {
  try {
    console.log(`[HOP DEBUG] recognizeSpeech (HTTP) được gọi với ${audioData ? audioData.length : 0} bytes, lang=${language || 'auto'}`);
    if (!audioData || audioData.length < AUDIO_CONFIG.minFrameLength * 2) { // Giả sử 16-bit PCM (2 bytes/sample)
      console.log(`[HOP DEBUG] Dữ liệu âm thanh quá ngắn (${audioData ? audioData.length : 0} bytes < ${AUDIO_CONFIG.minFrameLength * 2} bytes), bỏ qua.`);
      return { text: '', confidence: 0, language: language || 'unknown', isEmpty: true, error: 'Audio data too short' };
    }

    // Giới hạn độ dài tối đa
    if (audioData.length > AUDIO_CONFIG.maxFrameLength * 2) {
        console.log(`[HOP DEBUG] Giới hạn âm thanh từ ${audioData.length} xuống ${AUDIO_CONFIG.maxFrameLength * 2} bytes`);
        audioData = audioData.slice(0, AUDIO_CONFIG.maxFrameLength * 2);
    }

    // Kiểm tra kết nối ASR service (không thử lại quá thường xuyên ở đây, để loadModel xử lý)
    if (!isAsrServiceConnected) {
        const canConnect = await loadModel(); // Thử kết nối lại một lần nữa
        if (!canConnect) {
            logger.warn('ASR HTTP service not ready, không thể thực hiện nhận dạng.');
            console.warn('[HOP DEBUG] PhoWhisper ASR HTTP service chưa sẵn sàng.');
            return {
                text: '', // Không trả về "Xin chào (simulated)" nữa
                confidence: 0,
                language: language || 'unknown',
                isEmpty: true,
                error: 'ASR service not available'
            };
        }
    }

    // Thử sử dụng API đơn giản trước, nếu lỗi thì dùng API cũ
    try {
        console.log(`[HOP DEBUG] Thử dùng API đơn giản /recognize_simple...`);
        const simpleResult = await recognizeAudioViaHttpSimple(audioData, 'audio_stream.wav', language, initialPrompt);
        
        if (simpleResult) {
            console.log(`[HOP DEBUG] ✅ [ASR HTTP SIMPLE] Nhận kết quả: "${simpleResult.text}" (lang: ${simpleResult.language})`);
            return simpleResult;
        }
    } catch (simpleError) {
        logger.warn(`Lỗi khi sử dụng API đơn giản, thử API tiêu chuẩn: ${simpleError.message}`);
        console.warn(`[HOP DEBUG] API đơn giản thất bại, thử API tiêu chuẩn...`);
    }

    // Nếu API đơn giản thất bại, thử lại với API tiêu chuẩn
    const asrResult = await recognizeAudioViaHttp(audioData, 'audio_stream.wav', language, initialPrompt);

    if (!asrResult) {
        logger.error('Không nhận được kết quả từ ASR HTTP service.');
         return {
            text: '',
            confidence: 0,
            language: language || 'unknown',
            isEmpty: true,
            error: 'No result from ASR service'
        };
    }

    // Xử lý response từ ASR service thành object chuẩn
    const result = processAsrResponse(asrResult, language);
    console.log(`[HOP DEBUG] ✅ [ASR HTTP] Nhận kết quả: "${result.text}" (lang: ${result.language}, conf: ${result.confidence.toFixed(2)})`);
    return result;

  } catch (error) {
    logger.error(`Lỗi không mong muốn trong recognizeSpeech (HTTP): ${error.message}`, error);
    console.error("[HOP DEBUG] ❌ Lỗi không mong muốn trong speechService (HTTP):", error);
    isAsrServiceConnected = false; // Đánh dấu mất kết nối nếu có lỗi nghiêm trọng
    return {
        text: '',
        confidence: 0,
        language: language || 'unknown',
        isEmpty: true,
        error: `Internal error in speech service: ${error.message}`
    };
  }
}

/**
 * Thêm chunk âm thanh vào buffer
 * @param {Buffer} chunk
 */
const addAudioChunk = (chunk) => {
  // console.log(`[HOP DEBUG] addAudioChunk: thêm ${chunk.length} bytes vào buffer, buffer hiện tại: ${audioBuffer.length} bytes`);
  audioBuffer = Buffer.concat([audioBuffer, chunk]);
  // console.log(`[HOP DEBUG] Buffer sau khi thêm: ${audioBuffer.length} bytes`);
};

/**
 * Xử lý buffer hiện tại và xóa nó
 * @param {string} language
 * @param {string} initialPrompt
 */
const processAndClearBuffer = async (language = null, initialPrompt = null) => {
    console.log(`[HOP DEBUG] processAndClearBuffer được gọi, buffer length: ${audioBuffer.length}, min: ${AUDIO_CONFIG.minFrameLength * 2}`);
    if (audioBuffer.length >= AUDIO_CONFIG.minFrameLength * 2) {
        const bufferToProcess = Buffer.from(audioBuffer);
        audioBuffer = Buffer.alloc(0); // Xóa buffer ngay
        console.log(`[HOP DEBUG] Gọi recognizeSpeech (HTTP) với buffer ${bufferToProcess.length} bytes`);
        const result = await recognizeSpeech(bufferToProcess, language, initialPrompt);
        console.log(`[HOP DEBUG] Kết quả từ recognizeSpeech (HTTP):`, result);
        return result;
    } else {
        console.log(`[HOP DEBUG] Buffer quá ngắn để xử lý: ${audioBuffer.length} bytes < ${AUDIO_CONFIG.minFrameLength * 2} bytes`);
        return null; // Không xử lý nếu buffer quá ngắn, không trả lỗi
    }
};

/**
 * Xóa buffer âm thanh
 */
const clearTranscription = () => {
  audioBuffer = Buffer.alloc(0);
  console.log("[HOP DEBUG] Transcription buffer cleared.");
  return true;
};

/**
 * Lấy thông tin mô hình (thông tin tĩnh về kết nối ASR HTTP service)
 */
function getModelInfo() {
  return {
    name: 'PhoWhisper-HTTP',
    status: isAsrServiceConnected ? 'connected' : 'disconnected',
    backend: 'Python HTTP/Flask with Faster-Whisper',
    model_type: 'PhoWhisper-base (via Faster-Whisper)',
    languages: ['vi', 'en', 'auto-detect'], // Cập nhật nếu ASR service hỗ trợ thêm
    service_url: process.env.PHOWHISPER_ASR_URL || 'http://localhost:50051',
    service_ready: isAsrServiceConnected
  };
}

/**
 * Trả về một bản sao của buffer hiện tại mà không xóa nó
 * @returns {Buffer} Bản sao của buffer hiện tại
 */
const getBufferCopy = () => {
  return Buffer.from(audioBuffer); // Tạo bản sao để không ảnh hưởng đến buffer gốc
};

// Hàm trả về buffer hiện tại mà không xóa nó
const getAudioBuffer = () => {
  return audioBuffer.slice(); // Trả về bản sao của buffer, không thay đổi buffer gốc
};

// Hàm nhận dạng nhưng không xóa buffer, dùng cho chế độ liên tục
const recognizeSpeechWithoutClear = async (audioData, language = 'vi', initialPrompt = null) => {
  // Trả về kết quả tương tự nhưng không xóa buffer trong speech service
  try {
    // Ghi log thông tin
    logger.info(`Đang xử lý ${audioData.length} bytes audio (không xóa buffer) với ngôn ngữ ${language || 'auto'}`);
    
    // Gọi dịch vụ PhoWhisper ASR
    const result = await recognizeSpeech(audioData, language, initialPrompt);
    
    // Trả về kết quả
    return result;
  } catch (error) {
    logger.error(`Lỗi khi nhận dạng không xóa buffer: ${error.message}`);
    return {
      text: '',
      language: language || 'unknown',
      confidence: 0,
      isEmpty: true,
      error: error.message
    };
  }
};

/**
 * Nhận diện giọng nói streaming với session management
 * @param {Buffer} audioData - Buffer chứa dữ liệu âm thanh
 * @param {string} language - Ngôn ngữ (vi hoặc en, hoặc null để tự phát hiện)
 * @param {string} initialPrompt - Ngữ cảnh ban đầu (nếu có)
 * @param {string} userId - User ID để quản lý session
 * @returns {Promise<Object>} Kết quả nhận diện
 */
const recognizeSpeechStreaming = async (audioData, language = null, initialPrompt = null, userId = null) => {
  try {
    console.log(`[STREAMING] recognizeSpeech được gọi với ${audioData ? audioData.length : 0} bytes, lang=${language || 'auto'}, user=${userId}`);
    
    if (!audioData || audioData.length < AUDIO_CONFIG.minFrameLength * 2) {
      console.log(`[STREAMING] Dữ liệu âm thanh quá ngắn (${audioData ? audioData.length : 0} bytes < ${AUDIO_CONFIG.minFrameLength * 2} bytes), bỏ qua.`);
      return { text: '', confidence: 0, language: language || 'unknown', isEmpty: true, error: 'Audio data too short' };
    }

    // Giới hạn độ dài tối đa
    if (audioData.length > AUDIO_CONFIG.maxFrameLength * 2) {
        console.log(`[STREAMING] Giới hạn âm thanh từ ${audioData.length} xuống ${AUDIO_CONFIG.maxFrameLength * 2} bytes`);
        audioData = audioData.slice(0, AUDIO_CONFIG.maxFrameLength * 2);
    }

    // Kiểm tra kết nối ASR service nếu cần
    if (!isAsrServiceConnected) {
        await loadModel();
        if (!isAsrServiceConnected) {
            console.log('[STREAMING] ASR service không kết nối được.');
            return { text: '', confidence: 0, language: language || 'unknown', isEmpty: true, error: 'ASR service not available' };
        }
    }

    // Lấy hoặc tạo session ID cho user
    const sessionId = userId ? getOrCreateSessionId(userId) : null;

    // Gọi ASR streaming service
    console.log(`[STREAMING] Gọi PhoWhisper streaming service với session: ${sessionId}`);
    const asrResult = await recognizeAudioViaHttpStreaming(audioData, 'audio.wav', language, initialPrompt, sessionId);
    
    if (!asrResult) {
        console.log('[STREAMING] ASR streaming service trả về null.');
        return { text: '', confidence: 0, language: language || 'unknown', isEmpty: true, error: 'ASR service returned null' };
    }

    // Xử lý response từ ASR service thành object chuẩn
    const result = processAsrResponse(asrResult, language);
    console.log(`[STREAMING] ✅ [ASR STREAMING] Nhận kết quả: "${result.text}" (lang: ${result.language}, conf: ${result.confidence.toFixed(2)}, session: ${sessionId})`);
    return result;

  } catch (error) {
    logger.error(`[STREAMING] Lỗi không mong muốn trong recognizeSpeechStreaming: ${error.message}`, error);
    console.error("[STREAMING] ❌ Lỗi không mong muốn trong speechService streaming:", error);
    isAsrServiceConnected = false; // Đánh dấu mất kết nối nếu có lỗi nghiêm trọng
    return {
        text: '',
        confidence: 0,
        language: language || 'unknown',
        isEmpty: true,
        error: `Internal error in speech service: ${error.message}`
    };
  }
};

// Session management cho streaming
const userSessions = new Map(); // userId -> sessionId

/**
 * Tạo hoặc lấy session ID cho user
 * @param {string} userId 
 * @returns {string} sessionId
 */
const getOrCreateSessionId = (userId) => {
  if (!userSessions.has(userId)) {
    const sessionId = `session_${userId}_${Date.now()}`;
    userSessions.set(userId, sessionId);
    logger.info(`[SESSION] Tạo session mới cho user ${userId}: ${sessionId}`);
  }
  return userSessions.get(userId);
};

/**
 * Xóa session cho user
 * @param {string} userId 
 */
const clearUserSession = (userId) => {
  if (userSessions.has(userId)) {
    const sessionId = userSessions.get(userId);
    userSessions.delete(userId);
    logger.info(`[SESSION] Xóa session cho user ${userId}: ${sessionId}`);
  }
};

// Tự động kiểm tra kết nối khi module được import và định kỳ
loadModel(); // Kiểm tra ban đầu
// Không cần interval ở đây nữa, `loadModel` sẽ kiểm tra khi cần thiết
// hoặc `socket-server.js` có thể có interval riêng để gọi `loadModel`.

module.exports = {
  loadModel, // Để kiểm tra kết nối từ bên ngoài nếu cần
  recognizeSpeech,
  addAudioChunk,
  clearTranscription,
  getModelInfo,
  processAndClearBuffer,
  getBufferCopy, // Thêm hàm mới export
  isModelLoaded: () => isAsrServiceConnected, // Phản ánh trạng thái kết nối ASR HTTP service
  getAudioBuffer, // Thêm
  recognizeSpeechWithoutClear, // Thêm
  getOrCreateSessionId, // Thêm
  clearUserSession, // Thêm
  recognizeSpeechStreaming // Thêm
};
// server/socket/streamHandler.js
const speechService = require('../services/asr/speechService');
// Updated to use the main translation service file
const translationService = require('../services/translationService');
const ttsService = require('../services/ttsService');
const contextService = require('../services/contextService');
const logger = require('../utils/logger').createLogger('streamHandler');
const redis = require('../services/redisClient');

/**
 * Handler xử lý luồng âm thanh liên tục cho dịch vụ dịch thuật theo thời gian thực
 */
const streamHandler = {
  /**
   * Thiết lập kết nối WebSocket cho dịch vụ stream
   * @param {object} io - Instance Socket.io
   */
  setup: (io) => {
    // Tạo namespace /stream chuyên dụng
    const streamNamespace = io.of('/stream');

    streamNamespace.on('connection', async (socket) => {
      logger.info(`Client connected to stream: ${socket.id}`);
      let asrState = null; // Lưu trạng thái ASR
      let translationContext = null; // Lưu context dịch thuật
      let roomId = null; // Lưu ID phòng
      let sourceLanguage = 'vi'; // Ngôn ngữ nguồn mặc định
      let targetLanguage = 'en'; // Ngôn ngữ đích mặc định
        // Xử lý khi client tham gia phòng
      socket.on('join_room', async (data) => {
        try {
          // Normalize Room ID to lowercase
          roomId = data.roomId.toLowerCase();
          sourceLanguage = data.sourceLanguage || sourceLanguage;
          targetLanguage = data.targetLanguage || targetLanguage;
          
          socket.join(roomId);
          logger.info(`Client ${socket.id} joined room ${roomId}`);
          
          // Lấy context từ Redis nếu có
          const contextKey = `room:${roomId}:context`;
          const contextData = await redis.get(contextKey);
          if (contextData) {
            translationContext = JSON.parse(contextData);
            logger.info(`Loaded translation context for room ${roomId}`);
          }
          
          // Lấy trạng thái UI từ Redis
          const [subtitlesData, ttsData] = await Promise.all([
            redis.get(`room:${roomId}:subtitles`),
            redis.get(`room:${roomId}:tts`)
          ]);
          
          const subtitles = subtitlesData ? JSON.parse(subtitlesData) : { enabled: true };
          const tts = ttsData ? JSON.parse(ttsData) : { enabled: false };
          
          // Thông báo trạng thái hiện tại cho client
          socket.emit('room_joined', {
            roomId,
            sourceLanguage,
            targetLanguage,
            subtitles: subtitles.enabled,
            tts: tts.enabled,
            hasContext: !!translationContext
          });
        } catch (error) {
          logger.error(`Error in join_room: ${error.message}`);
          socket.emit('error', { message: 'Failed to join room' });
        }
      });
      
      // Xử lý khi client gửi audio data
      socket.on('audio_data', async (audioData) => {
        try {
          if (!roomId) {
            socket.emit('error', { message: 'Not joined to any room' });
            return;
          }
            // Sử dụng PhoWhisper ASR để nhận dạng giọng nói với Circuit Breaker
          // Giữ trạng thái giữa các lần gọi để liên tục cập nhật
          let asrResult;
          try {
            // Use the circuit breaker pattern for ASR
            const unixSocketManager = require('../services/socket/unixSocketManager');
            asrResult = await unixSocketManager.recognizeWithCircuitBreaker(
              audioData, 
              {
                language: sourceLanguage,
                state: asrState
              }
            );
            
            // Cập nhật trạng thái ASR cho lần tiếp theo
            asrState = asrResult.state;
          } catch (error) {
            logger.error(`Circuit breaker error in ASR: ${error.message}`);
            socket.emit('asr_error', { message: 'Speech recognition service unavailable' });
            return;
          }
          
          // Nếu có văn bản được nhận dạng, thực hiện dịch thuật
          if (asrResult.text && asrResult.text.trim()) {
            // Dịch văn bản với context sử dụng Circuit Breaker
            let translationResult;
            try {
              const unixSocketManager = require('../services/socket/unixSocketManager');
              translationResult = await unixSocketManager.translateWithCircuitBreaker(
                asrResult.text,
                sourceLanguage,
                targetLanguage,
                translationContext
              );
            } catch (error) {
              logger.error(`Circuit breaker error in Translation: ${error.message}`);
              socket.emit('translation_error', { message: 'Translation service unavailable' });
              // Vẫn tiếp tục xử lý mà không dịch
              translationResult = { text: asrResult.text, error: true };
            }
            
            // Kiểm tra nếu TTS được bật
            const ttsKey = `room:${roomId}:tts`;
            const ttsData = await redis.get(ttsKey);
            const ttsEnabled = ttsData ? JSON.parse(ttsData).enabled : false;
            
            let ttsAudioBuffer = null;
              // Nếu TTS được bật, tạo audio từ văn bản đã dịch với Circuit Breaker
            if (ttsEnabled && translationResult.translatedText) {
              try {
                const unixSocketManager = require('../services/socket/unixSocketManager');
                const ttsResult = await unixSocketManager.synthesizeWithCircuitBreaker(
                  translationResult.translatedText,
                  targetLanguage,
                  {} // Không cần options đặc biệt
                );
                
                if (ttsResult && ttsResult.audioBuffer) {
                  ttsAudioBuffer = ttsResult.audioBuffer;
                }
              } catch (ttsError) {
                logger.error(`TTS circuit breaker error: ${ttsError.message}`);
                socket.emit('tts_error', { message: 'Text-to-Speech service unavailable' });
              }
            }
            
            // Gửi kết quả về cho tất cả client trong phòng
            streamNamespace.to(roomId).emit('translation_result', {
              roomId,
              originalText: asrResult.text,
              translatedText: translationResult.translatedText,
              sourceLanguage,
              targetLanguage,
              timestamp: Date.now(),
              ttsAudio: ttsAudioBuffer ? {
                buffer: ttsAudioBuffer.toString('base64'),
                format: 'wav'
              } : null,
              final: asrResult.isFinal || false
            });
          }
        } catch (error) {
          logger.error(`Error processing audio stream: ${error.message}`);
          socket.emit('error', { message: 'Failed to process audio data' });
        }
      });
      
      // Xử lý khi client cập nhật context
      socket.on('update_context', async (data) => {
        try {
          if (!roomId) {
            socket.emit('error', { message: 'Not joined to any room' });
            return;
          }
          
          // Lưu context mới
          translationContext = data.context;
          
          // Lưu vào Redis
          const contextKey = `room:${roomId}:context`;
          await redis.set(contextKey, JSON.stringify(translationContext));
          
          // Thông báo cho tất cả client trong phòng
          streamNamespace.to(roomId).emit('context_updated', {
            hasContext: !!translationContext
          });
          
          logger.info(`Updated translation context for room ${roomId}`);
        } catch (error) {
          logger.error(`Error updating context: ${error.message}`);
          socket.emit('error', { message: 'Failed to update context' });
        }
      });
      
      // Xử lý khi client thay đổi cài đặt phụ đề
      socket.on('toggle_subtitles', async (data) => {
        try {
          if (!roomId) {
            socket.emit('error', { message: 'Not joined to any room' });
            return;
          }
          
          const { enabled } = data;
          
          // Lưu trạng thái phụ đề vào Redis
          const subtitlesKey = `room:${roomId}:subtitles`;
          await redis.set(subtitlesKey, JSON.stringify({ enabled: !!enabled }));
          
          // Broadcast cho tất cả client trong phòng
          streamNamespace.to(roomId).emit('subtitles_state_change', { 
            enabled: !!enabled 
          });
          
          logger.info(`Subtitles ${enabled ? 'enabled' : 'disabled'} for room ${roomId} via socket`);
        } catch (error) {
          logger.error(`Error toggling subtitles via socket: ${error.message}`);
          socket.emit('error', { message: 'Failed to toggle subtitles' });
        }
      });
      
      // Xử lý khi client thay đổi cài đặt TTS
      socket.on('toggle_tts', async (data) => {
        try {
          if (!roomId) {
            socket.emit('error', { message: 'Not joined to any room' });
            return;
          }
          
          const { enabled } = data;
          
          // Lưu trạng thái TTS vào Redis
          const ttsKey = `room:${roomId}:tts`;
          await redis.set(ttsKey, JSON.stringify({ enabled: !!enabled }));
          
          // Broadcast cho tất cả client trong phòng
          streamNamespace.to(roomId).emit('tts_state_change', { 
            enabled: !!enabled 
          });
          
          logger.info(`TTS ${enabled ? 'enabled' : 'disabled'} for room ${roomId} via socket`);
        } catch (error) {
          logger.error(`Error toggling TTS via socket: ${error.message}`);
          socket.emit('error', { message: 'Failed to toggle TTS' });
        }
      });

      // Xử lý khi client yêu cầu trạng thái UI
      socket.on('get_ui_state', async () => {
        try {
          if (!roomId) {
            socket.emit('error', { message: 'Not joined to any room' });
            return;
          }
          
          // Lấy trạng thái từ Redis
          const subtitlesKey = `room:${roomId}:subtitles`;
          const ttsKey = `room:${roomId}:tts`;
          
          const [subtitlesData, ttsData] = await Promise.all([
            redis.get(subtitlesKey),
            redis.get(ttsKey)
          ]);
          
          const subtitles = subtitlesData ? JSON.parse(subtitlesData) : { enabled: true };
          const tts = ttsData ? JSON.parse(ttsData) : { enabled: false };
          
          // Gửi trạng thái cho client
          socket.emit('ui_state', {
            roomId,
            subtitles: subtitles.enabled,
            tts: tts.enabled
          });
          
          logger.debug(`UI state sent to client ${socket.id}`);
        } catch (error) {
          logger.error(`Error getting UI state: ${error.message}`);
          socket.emit('error', { message: 'Failed to get UI state' });
        }
      });
      
      // Xử lý khi client ngắt kết nối
      socket.on('disconnect', () => {
        logger.info(`Client disconnected from stream: ${socket.id}`);
        
        // Dọn dẹp tài nguyên
        asrState = null;
        translationContext = null;
      });
    });
  }
};

module.exports = streamHandler;

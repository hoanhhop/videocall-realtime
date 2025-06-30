// server/controllers/socketController.js
const speechService = require('../services/speechService');
const translationService = require('../services/translationService');
const contextService = require('../services/contextService');
const { createLogger } = require('../utils/logger');

// Khởi tạo logger
const logger = createLogger('socket-controller');

// Lưu trữ tạm thời rooms và users
const rooms = new Map();

// Biến lưu trữ timer cho việc xử lý buffer sau khoảng im lặng
const userAudioTimers = new Map();
const SILENCE_TIMEOUT_MS = 500; // Giữ nguyên 500ms

// Thêm biến cho xử lý liên tục theo thời gian
const userContinuousTimers = new Map();
const userAudioBufferSizes = new Map(); // Lưu kích thước buffer cho mỗi user
const CONTINUOUS_PROCESSING_INTERVAL_MS = 300; // Giảm từ 600ms xuống 300ms
const MIN_BUFFER_SIZE_FOR_CONTINUOUS = 1200; // Giảm từ 2400 xuống 1200 bytes

// Hàm xử lý audio buffer liên tục theo thời gian
const processContinuously = async (socket, userId, language, initialPrompt) => {
  try {
    // Lấy buffer hiện tại từ speech service
    const bufferToProcess = speechService.getAudioBuffer(); // Lấy audio buffer hiện tại
    
    if (!bufferToProcess || bufferToProcess.length < MIN_BUFFER_SIZE_FOR_CONTINUOUS) {
      console.log(`[HOP DEBUG] Buffer không đủ lớn (${bufferToProcess?.length || 0} bytes) để xử lý liên tục, cần ít nhất ${MIN_BUFFER_SIZE_FOR_CONTINUOUS} bytes`);
      return;
    }
    
    console.log(`[HOP DEBUG] Xử lý liên tục cho user ${userId}, buffer=${bufferToProcess.length} bytes`);
    
    // Xử lý nhận dạng nhưng KHÔNG xóa buffer
    const result = await speechService.recognizeSpeechWithoutClear(bufferToProcess, language, initialPrompt);
    
    if (result && !result.isEmpty && result.text.trim() !== '') {
      console.log(`[HOP DEBUG] Kết quả nhận dạng liên tục: "${result.text}"`);
      
      // Emit kết quả nhận dạng
      socket.emit('transcription-result', {
        text: result.text,
        language: result.language,
        confidence: result.confidence,
        isFinal: false, // Đánh dấu đây là kết quả trung gian
        isSimulated: result.isSimulated,
        inferenceTime: result.inferenceTime,
        timestamp: new Date().toISOString(),
        source: result.source,
      });

      // Dịch và gửi kết quả dịch trung gian
      try {
        const translationResult = await translationService.translateText(result.text, language, 'en');
        if (translationResult && translationResult.text) {
          socket.emit('translation-result', {
            originalText: result.text,
            translatedText: translationResult.text,
            originalLanguage: result.language,
            targetLanguage: 'en',
            confidence: translationResult.confidence,
            isFinal: false, // Kết quả dịch trung gian
            timestamp: new Date().toISOString()
          });
        }
      } catch (translationError) {
        console.error(`[HOP DEBUG] Lỗi dịch thuật liên tục: ${translationError.message}`);
      }
    }
  } catch (error) {
    console.error(`[HOP DEBUG] Lỗi trong xử lý liên tục: ${error.message}`);
  }
};

// Hàm xử lý real-time transcription với latency thấp
const processRealTimeTranscription = async (socket, userId, language, initialPrompt) => {
  try {
    // Lấy buffer hiện tại từ speech service
    const bufferToProcess = speechService.getAudioBuffer();
    
    if (!bufferToProcess || bufferToProcess.length < 400) { // Threshold thấp hơn cho real-time
      console.log(`[HOP DEBUG REALTIME] Buffer quá nhỏ (${bufferToProcess?.length || 0} bytes) cho real-time`);
      return;
    }
    
    console.log(`[HOP DEBUG REALTIME] Xử lý real-time cho user ${userId}, buffer=${bufferToProcess.length} bytes`);
    
    // Xử lý nhận dạng KHÔNG xóa buffer (để maintain context)
    const result = await speechService.recognizeSpeechWithoutClear(bufferToProcess, language, initialPrompt);
    
    if (result && !result.isEmpty && result.text.trim() !== '') {
      console.log(`[HOP DEBUG REALTIME] Kết quả real-time: "${result.text}"`);
      
      // Emit kết quả real-time với flag đặc biệt
      socket.emit('transcription-result', {
        text: result.text,
        language: result.language,
        confidence: result.confidence,
        isFinal: false,
        isRealTime: true, // Flag đặc biệt cho real-time
        isSimulated: result.isSimulated,
        inferenceTime: result.inferenceTime,
        timestamp: new Date().toISOString(),
        source: result.source,
      });

      // Real-time translation (chỉ dịch nếu có văn bản đủ dài)
      if (result.text.length > 10) {
        try {
          const translationResult = await translationService.translateText(result.text, language, 'en');
          if (translationResult && translationResult.text) {
            socket.emit('translation-result', {
              originalText: result.text,
              translatedText: translationResult.text,
              originalLanguage: result.language,
              targetLanguage: 'en',
              confidence: translationResult.confidence,
              isFinal: false,
              isRealTime: true, // Flag cho real-time translation
              timestamp: new Date().toISOString()
            });
          }
        } catch (translationError) {
          console.error(`[HOP DEBUG REALTIME] Lỗi dịch real-time: ${translationError.message}`);
        }
      }
      
      // Giảm buffer size để không quá tải memory trong real-time mode
      const currentSize = userAudioBufferSizes.get(userId) || 0;
      if (currentSize > 3000) { // Nếu buffer quá lớn
        userAudioBufferSizes.set(userId, Math.floor(currentSize / 2));
        console.log(`[HOP DEBUG REALTIME] Giảm buffer size từ ${currentSize} xuống ${Math.floor(currentSize / 2)}`);
      }
    }
  } catch (error) {
    console.error(`[HOP DEBUG REALTIME] Lỗi trong xử lý real-time: ${error.message}`);
  }
};

const socketController = {
  /**
   * Handle WebRTC signaling
   */
  handleSignal: (socket, data, redisClient) => {
    try {
      logger.info(`Signal from ${socket.id}`);
      
      // Broadcast đến tất cả clients trong phòng ngoại trừ sender
      const roomId = getRoomIdFromSocket(socket);
      if (roomId) {
        socket.to(roomId).emit('signal', data);
      } else {
        // Broadcast to all if room not found (fallback)
        socket.broadcast.emit('signal', data);
      }
    } catch (error) {
      logger.error('Error handling signal:', error);
      socket.emit('error', { message: 'Signal processing failed' });
    }
  },
  
  /**
   * Handle room join for multi-user video calls
   */
  handleJoinRoom: (socket, roomId, userId, redisClient) => {
    try {
      // Normalize Room ID to lowercase
      const normalizedRoomId = roomId.toLowerCase();
      
      // Rời phòng cũ nếu có
      leaveCurrentRoom(socket);
      
      // Tham gia phòng mới
      socket.join(normalizedRoomId);
      
      // Lưu thông tin user vào room
      if (!rooms.has(normalizedRoomId)) {
        rooms.set(normalizedRoomId, new Set());
      }
      
      const users = rooms.get(normalizedRoomId);
      users.add(userId);
      
      // Lưu thông tin ngược để biết user thuộc phòng nào
      socket.data.roomId = normalizedRoomId;
      socket.data.userId = userId;
      
      logger.info(`User ${userId} joined room ${normalizedRoomId}`);
      
      // Thông báo cho mọi người trong phòng (trừ người mới vào)
      socket.to(normalizedRoomId).emit('user-connected', userId);
      
      // Thiết lập sự kiện khi disconnect
      socket.on('disconnect', () => {
        if (socket.data.roomId && socket.data.userId) {
          const roomId = socket.data.roomId;
          const userId = socket.data.userId;
          
          if (rooms.has(roomId)) {
            const users = rooms.get(roomId);
            users.delete(userId);
            
            // Xóa phòng nếu không còn ai
            if (users.size === 0) {
              rooms.delete(roomId);
            }
          }
          
          // Thông báo cho mọi người trong phòng
          socket.to(roomId).emit('user-disconnected', userId);
          logger.info(`User ${userId} disconnected from room ${roomId}`);
        }
      });
    } catch (error) {
      logger.error('Error handling room join:', error);
      socket.emit('error', { message: 'Failed to join room' });
    }
  },
  
  /**
   * Handle audio stream for speech recognition
   */
  handleAudioStream: async (socket, data, redisClient) => {
    try {
      const { audioData, language = 'vi', initialPrompt = null, continuousMode = true, realTimeMode = false } = data;
      const userId = socket.data.userId || socket.id;

      if (!audioData) {
        logger.warn('Nhận được gói dữ liệu âm thanh rỗng');
        return;
      }

      let audioBufferChunk;
      if (audioData instanceof Uint8Array) {
        audioBufferChunk = Buffer.from(audioData);
      } else if (Array.isArray(audioData)) {
        audioBufferChunk = Buffer.from(audioData);
      } else if (Buffer.isBuffer(audioData)) {
          audioBufferChunk = audioData; // Đã là Buffer
      } else if (typeof audioData === 'object') {
        audioBufferChunk = Buffer.from(audioData);
      } else {
        logger.error(`Định dạng âm thanh không hỗ trợ: ${typeof audioData}`);
        socket.emit('transcription-error', { error: 'Định dạng âm thanh không được hỗ trợ' });
        return;
      }

      if (audioBufferChunk.length === 0) return; // Bỏ qua chunk rỗng

      console.log(`[HOP DEBUG] Nhận audio từ client ${socket.id}, lang: ${language}, prompt: ${initialPrompt}, continuous: ${continuousMode}, realTime: ${realTimeMode}, chiều dài: ${audioBufferChunk.length}`);

      // Thêm chunk vào buffer của speechService
      speechService.addAudioChunk(audioBufferChunk);
      
      // Cập nhật kích thước buffer hiện tại
      const currentSize = (userAudioBufferSizes.get(userId) || 0) + audioBufferChunk.length;
      userAudioBufferSizes.set(userId, currentSize);

      // Real-time mode: Xử lý ngay khi có đủ data nhỏ
      if (realTimeMode === true) {
        const REAL_TIME_MIN_BUFFER = 800; // Nhỏ hơn cho real-time
        const REAL_TIME_INTERVAL = 200;   // Xử lý mỗi 200ms
        
        // Xóa timer cũ nếu có
        if (userContinuousTimers.has(userId)) {
          clearTimeout(userContinuousTimers.get(userId));
        }
        
        // Xử lý ngay nếu buffer đủ lớn
        if (currentSize >= REAL_TIME_MIN_BUFFER) {
          console.log(`[HOP DEBUG REALTIME] Buffer đủ (${currentSize} bytes) cho real-time processing!`);
          processRealTimeTranscription(socket, userId, language, initialPrompt);
        }
        
        // Thiết lập timer xử lý real-time liên tục
        const realTimeTimerId = setTimeout(() => {
          processRealTimeTranscription(socket, userId, language, initialPrompt);
        }, REAL_TIME_INTERVAL);
        
        userContinuousTimers.set(userId, realTimeTimerId);
        
        // Không thiết lập silence timer trong real-time mode
        return;
      }

      // Thiết lập hoặc làm mới timer xử lý liên tục (nếu được bật)
      if (continuousMode === true) {
        // Xóa timer cũ nếu có
        if (userContinuousTimers.has(userId)) {
          clearTimeout(userContinuousTimers.get(userId));
        }
        
        // XỬ LÝ NGAY LẬP TỨC nếu buffer đã đủ lớn
        if (currentSize >= MIN_BUFFER_SIZE_FOR_CONTINUOUS) {
          // Xử lý ngay lập tức nếu đạt đủ kích thước
          if (currentSize >= MIN_BUFFER_SIZE_FOR_CONTINUOUS * 2) {
            console.log(`[HOP DEBUG] Buffer đủ lớn (${currentSize} bytes) để xử lý ngay lập tức!`);
            processContinuously(socket, userId, language, initialPrompt);
            // Sau khi xử lý, reset kích thước buffer về 1/3 để có thể xử lý tiếp tục nhanh chóng
            userAudioBufferSizes.set(userId, Math.floor(currentSize / 3));
          } 
          
          // Dù xử lý ngay hay không, vẫn thiết lập timer để xử lý định kỳ
          const continuousTimerId = setTimeout(() => {
            processContinuously(socket, userId, language, initialPrompt);
            // Sau khi xử lý, reset kích thước buffer về 1/3 để có thể xử lý tiếp tục nhanh chóng
            userAudioBufferSizes.set(userId, Math.floor(currentSize / 3));
          }, CONTINUOUS_PROCESSING_INTERVAL_MS);
          
          userContinuousTimers.set(userId, continuousTimerId);
        }
      }
      
      // Reset timer xử lý sau khoảng im lặng (final processing)
      if (userAudioTimers.has(userId)) {
          clearTimeout(userAudioTimers.get(userId));
      }

      const timerId = setTimeout(async () => {
        logger.info(`Silence detected for user ${userId}, processing buffer with lang: ${language}, prompt: ${initialPrompt ? 'yes' : 'no'}...`);
          
        // Xử lý và xóa buffer hiện tại
        const result = await speechService.processAndClearBuffer(language, initialPrompt);
        
        // Reset kích thước buffer sau khi xử lý
        userAudioBufferSizes.set(userId, 0);
        
        // Xóa timer liên tục nếu có
        if (userContinuousTimers.has(userId)) {
          clearTimeout(userContinuousTimers.get(userId));
          userContinuousTimers.delete(userId);
        }

          if (result && !result.isEmpty) {
            // Emit transcription result
            socket.emit('transcription-result', {
                text: result.text,
                language: result.language,
                confidence: result.confidence,
                isFinal: true,
                isSimulated: result.isSimulated,
                inferenceTime: result.inferenceTime,
                timestamp: new Date().toISOString(),
                source: result.source
            });

            // Emit để dịch
            const translatedResult = await translationService.translateText(result.text, language, 'en');
            if (translatedResult && translatedResult.text) {
                socket.emit('translation-result', {
                    originalText: result.text,
                    translatedText: translatedResult.text,
                    originalLanguage: result.language,
                    targetLanguage: 'en',
                    confidence: translatedResult.confidence,
                    timestamp: new Date().toISOString()
                });
            }

            logger.info(`Transcription and translation completed for user ${userId}`);
          } else if (result && result.error) {
              console.log(`[HOP_DEBUG] Kết quả xử lý buffer cho user ${userId}: ${JSON.stringify(result)}`);
              socket.emit('transcription-error', {
                  error: 'Failed to process audio buffer',
                  details: result.error
              });
              logger.error(`Error processing audio buffer for ${userId}:`, result.error);
          } else {
              console.log('[HOP DEBUG] Kết quả null hoặc isEmpty = true');
          }
      }, SILENCE_TIMEOUT_MS);

      userAudioTimers.set(userId, timerId);

    } catch (error) {
      logger.error('Error processing audio stream:', error);
      console.log('[HOP DEBUG] Lỗi khi xử lý audio stream:', error);
      socket.emit('transcription-error', {
        error: 'Failed to process audio stream',
        details: error.message
      });
    }
  },
  
  // Thêm xử lý sự kiện dừng nhận diện
  handleStopRecognition: (socket, data) => {
    const userId = socket.data.userId || socket.id;
    
    // Xóa timer xử lý liên tục
    if (userContinuousTimers.has(userId)) {
      clearInterval(userContinuousTimers.get(userId));
      userContinuousTimers.delete(userId);
      console.log(`[HOP DEBUG] Đã dừng chế độ xử lý liên tục cho user ${userId}`);
    }
    
    // Cũng hủy timer khoảng lặng
    if (userAudioTimers.has(userId)) {
      clearTimeout(userAudioTimers.get(userId));
      userAudioTimers.delete(userId);
    }
    
    console.log(`[HOP DEBUG] Đã dừng xử lý audio cho user ${userId}`);
    
    // Lưu ý: KHÔNG xóa buffer ở đây, để cơ chế khoảng lặng xử lý buffer và xóa nó
  },
  
  /**
   * Handle translation request
   */
  handleTranslateText: async (socket, data, redisClient) => {
    try {
      const { text, source, target, context } = data;
      
      if (!text) {
        socket.emit('translation-error', { error: 'No text provided' });
        return;
      }
      
      // Xử lý context nếu có
      let processedContext = null;
      if (context) {
        processedContext = contextService.processContext(context, source, target);
      }
      
      // Lấy bản dịch từ service
      let translationResult;
      if (processedContext) {
        // Tạo enhanced prompt với context
        const enhancedPrompt = contextService.createTranslationPrompt(
          text, processedContext, source, target
        );
        
        translationResult = await translationService.translateWithContext(
          text, source, target, processedContext, enhancedPrompt
        );
      } else {
        translationResult = await translationService.translateText(text, source, target);
      }
      
      console.log(`[HOP DEBUG] Kết quả dịch thuật gốc: ${JSON.stringify(translationResult)}`);
      
      // Trích xuất chuỗi văn bản dịch
      let translatedText = '';
      
      if (typeof translationResult === 'string') {
        translatedText = translationResult;
      } else if (typeof translationResult.text === 'string') {
        translatedText = translationResult.text;
      } else if (translationResult.translated && typeof translationResult.translated === 'string') {
        translatedText = translationResult.translated;
      } else {
        // Nếu không tìm được định dạng phù hợp, thử chuyển đổi thành chuỗi
        translatedText = JSON.stringify(translationResult);
      }
      
      console.log(`[HOP DEBUG] Extracted translatedText for manual translation: "${translatedText}"`);
      
      // Gửi kết quả dịch với format nhất quán giống như service Python trả về
      const superSimpleResponse = {
        originalText: text,
        translatedText: translatedText,
        sourceLang: source,
        targetLang: target,
        model: source === 'vi' ? 'Helsinki-NLP/opus-mt-vi-en' : 'Helsinki-NLP/opus-mt-en-vi',
        timestamp: Date.now(),
        processingTimeMs: 0.476
      };
      
      console.log(`[HOP DEBUG] Gửi kết quả dịch chuẩn hóa: ${JSON.stringify(superSimpleResponse)}`);
      socket.emit('translation-result', superSimpleResponse);
      
      logger.debug(`Translation for ${socket.id}: ${text} -> ${translatedText}`);
    } catch (error) {
      logger.error('Error translating text:', error);
      socket.emit('translation-error', { 
        error: 'Failed to translate text',
        details: error.message
      });
    }
  },
  
  /**
   * Handle subtitle generation request
   */
  handleGenerateSubtitle: async (socket, data, redisClient) => {
    try {
      const { text, language, duration } = data;
      
      // Tạo định dạng VTT
      const vttContent = `WEBVTT

00:00:00.000 --> 00:00:${duration || '05.000'}
${text}`;
      
      socket.emit('subtitle-result', {
        vtt: vttContent,
        language,
        text,
        timestamp: Date.now()
      });
      
      logger.debug(`Subtitle generated for ${socket.id}`);
    } catch (error) {
      logger.error('Error generating subtitle:', error);
      socket.emit('subtitle-error', { 
        error: 'Failed to generate subtitle',
        details: error.message
      });
    }
  }
};

// Utility để lấy roomId từ socket nếu có
function getRoomIdFromSocket(socket) {
  return socket.data?.roomId;
}

// Utility để rời khỏi phòng hiện tại
function leaveCurrentRoom(socket) {
  if (socket.data && socket.data.roomId) {
    const roomId = socket.data.roomId;
    const userId = socket.data.userId;
    
    socket.leave(roomId);
    
    if (rooms.has(roomId)) {
      const users = rooms.get(roomId);
      users.delete(userId);
      
      if (users.size === 0) {
        rooms.delete(roomId);
      }
    }
    
    logger.info(`User ${userId} left room ${roomId}`);
  }
}

module.exports = socketController;
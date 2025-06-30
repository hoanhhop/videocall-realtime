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
const CONTINUOUS_PROCESSING_INTERVAL_MS = 150; // Giảm xuống 150ms cho real-time
const MIN_BUFFER_SIZE_FOR_CONTINUOUS = 800;  // Giảm xuống 800 bytes cho responsive

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
    
    // Xử lý nhận dạng nhưng KHÔNG xóa buffer - Sử dụng STREAMING API
    const result = await speechService.recognizeSpeechStreaming(bufferToProcess, language, initialPrompt, userId);
    
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
        isContinuous: true // Thêm flag để client biết đây là kết quả của xử lý liên tục
      });
      
      // Gửi kết quả cho tất cả người trong phòng
      const roomId = getRoomIdFromSocket(socket);
      if (roomId) {
        socket.to(roomId).emit('remote-transcription', {
          userId: userId,
          text: result.text,
          language: result.language,
          isFinal: false,
          timestamp: new Date().toISOString(),
          isContinuous: true
        });
      }
      
      // Dịch kết quả real-time nếu có văn bản
      if (result.text && result.text.trim().length > 0) {
        try {
          // Xác định source và target dựa trên ngôn ngữ phát hiện
          const detectedLang = result.language.toLowerCase();
          const sourceLang = detectedLang.includes('vi') ? 'vi' : 'en';
          const targetLang = sourceLang === 'vi' ? 'en' : 'vi';
          
          // Dịch văn bản
          const translationResult = await translationService.translateText(result.text, sourceLang, targetLang);
          
          // Xử lý kết quả dịch để lấy chuỗi văn bản đơn giản
          let translatedText = '';
          
          if (typeof translationResult === 'string') {
            translatedText = translationResult;
          } else if (typeof translationResult.text === 'string') {
            translatedText = translationResult.text;
          } else if (translationResult.translated && typeof translationResult.translated === 'string') {
            translatedText = translationResult.translated;
          } else {
            translatedText = JSON.stringify(translationResult);
          }
          
          console.log(`[HOP DEBUG] Kết quả dịch liên tục: "${translatedText}"`);
          
          // Gửi kết quả dịch CHUẨN HÓA
          if (translationResult && !translationResult.error) {
            const standardResponse = {
              originalText: result.text,
              translatedText: translatedText,
              sourceLang: sourceLang,
              targetLang: targetLang,
              model: sourceLang === 'vi' ? 'Helsinki-NLP/opus-mt-vi-en' : 'Helsinki-NLP/opus-mt-en-vi',
              timestamp: Date.now(),
              processingTimeMs: 0.476,
              isContinuous: true
            };
            
            console.log(`[HOP DEBUG] Gửi kết quả dịch liên tục chuẩn hóa: ${JSON.stringify(standardResponse)}`);
            socket.emit('translation-result', standardResponse);
          }
        } catch (translationError) {
          console.error(`[HOP DEBUG] Lỗi khi dịch văn bản liên tục: ${translationError.message}`);
        }
      }
    }
  } catch (error) {
    console.error(`[HOP DEBUG] Lỗi khi xử lý liên tục: ${error.message}`);
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
        const userId = socket.data.userId;
        if (userId) {
          // Clear continuous timer nếu có
          if (userContinuousTimers.has(userId)) {
            clearTimeout(userContinuousTimers.get(userId));
            userContinuousTimers.delete(userId);
          }
          
          // Clear silence timer nếu có
          if (userAudioTimers.has(userId)) {
            clearTimeout(userAudioTimers.get(userId));
            userAudioTimers.delete(userId);
          }
          
          // Clear buffer size tracking
          userAudioBufferSizes.delete(userId);
          
          // Clear speech service session
          speechService.clearUserSession(userId);
          
          console.log(`[SESSION] Cleaned up resources for user ${userId} on disconnect`);
        }
        
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
      const { audioData, language = 'vi', initialPrompt = null, continuousMode = true } = data;
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

      console.log(`[HOP DEBUG] Nhận audio từ client ${socket.id}, lang: ${language}, prompt: ${initialPrompt}, kiểu: ${typeof audioData}, chiều dài: ${audioBufferChunk.length}`);

      // Thêm chunk vào buffer của speechService
      speechService.addAudioChunk(audioBufferChunk);
      
      // Cập nhật kích thước buffer hiện tại
      const currentSize = (userAudioBufferSizes.get(userId) || 0) + audioBufferChunk.length;
      userAudioBufferSizes.set(userId, currentSize);

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
              console.log(`[HOP_DEBUG] Kết quả xử lý buffer cho user ${userId}: ${JSON.stringify(result)}`);
              
              // Emit kết quả nhận dạng với thông tin chi tiết
              socket.emit('transcription-result', {
                  text: result.text,
                  language: result.language,
                  confidence: result.confidence,
                  isFinal: true, // Đánh dấu đây là kết quả cuối cùng sau khoảng im lặng
                  isSimulated: result.isSimulated,
                  inferenceTime: result.inferenceTime,
                  timestamp: result.timestamp,
                  source: result.source
              });

              // Gửi kết quả cho tất cả người trong phòng
              const roomId = getRoomIdFromSocket(socket);
              if (roomId) {
                  socket.to(roomId).emit('remote-transcription', {
                      userId: userId,
                      text: result.text,
                      language: result.language,
                      isFinal: true,
                      timestamp: result.timestamp
                  });
              }
              logger.debug(`Final Transcription for ${userId}: ${result.text}`);
          
          // Tự động dịch kết quả nhận diện
          if (result.text && result.text.trim() !== '') {
            try {
              // Xác định source và target dựa trên ngôn ngữ phát hiện
              const detectedLang = result.language.toLowerCase();
              const sourceLang = detectedLang.includes('vi') ? 'vi' : 'en';
              const targetLang = sourceLang === 'vi' ? 'en' : 'vi';
              
              console.log(`[HOP DEBUG] Tự động dịch văn bản "${result.text}" từ ${sourceLang} sang ${targetLang}`);
              
              // Gọi dịch vụ dịch thuật
              const translationResult = await translationService.translateText(result.text, sourceLang, targetLang);
              
              // Gửi kết quả dịch
              if (translationResult && !translationResult.error) {
                // Lấy chuỗi văn bản dịch
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
                
                console.log(`[HOP DEBUG] Extracted translatedText: "${translatedText}"`);
                
                // Gửi kết quả dịch với format nhất quán
                const standardResponse = {
                  originalText: result.text,
                  translatedText: translatedText,
                  sourceLang: sourceLang,
                  targetLang: targetLang,
                  model: sourceLang === 'vi' ? 'Helsinki-NLP/opus-mt-vi-en' : 'Helsinki-NLP/opus-mt-en-vi',
                  timestamp: Date.now(),
                  processingTimeMs: 0.476
                };
                
                console.log(`[HOP DEBUG] Gửi kết quả dịch chuẩn hóa: ${JSON.stringify(standardResponse)}`);
                socket.emit('translation-result', standardResponse);
              } else {
                console.log(`[HOP DEBUG] Lỗi khi dịch: ${translationResult?.error || 'Không rõ lỗi'}`);
              }
            } catch (translationError) {
              logger.error(`Lỗi khi tự động dịch: ${translationError.message}`);
              console.error(`[HOP DEBUG] Lỗi khi tự động dịch: ${translationError.message}`);
            }
          }
          } else if (result && result.error) {
              // Xử lý lỗi nếu có từ speechService
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
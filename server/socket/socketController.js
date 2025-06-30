// server/socketController.js
const { createLogger } = require('../utils/logger');
const speechService = require('../services/asr/speechService');
// Updated to use the main translation service file
const translationService = require('../services/translationService');
const { getUserById, setUserOnline, setUserOffline, getOnlineUsers } = require('../controllers/authController');
const callController = require('../controllers/callController');
// const subtitleService = require('./services/subtitleService'); // Tạm thời comment out

// Khởi tạo logger
const logger = createLogger('socket-controller');

// Lưu trữ các timers cho xử lý âm thanh của từng user
const userAudioTimers = new Map();
// MODIFIED: Giảm thời gian chờ để xử lý nhanh hơn, tăng tính "real-time"
const SILENCE_TIMEOUT_MS = 400; // Trước đây là 1000ms

// NEW: Lưu trữ prompt cuối cùng cho mỗi user để cải thiện ngữ cảnh ASR
const userLastPrompt = new Map();

// Lưu trữ phòng hiện tại của socket
const socketRooms = new Map();

// Hàm trợ giúp để lấy roomId của socket
const getRoomIdFromSocket = (socket) => {
  if (!socket) return null;
  return socketRooms.get(socket.id) || null;
};

const socketController = {
  /**
   * Handle user online status
   */
  handleUserOnline: (socket, userData) => {
    try {
      const user = setUserOnline(userData.id);
      if (user) {
        socket.data.userId = userData.id;
        socket.data.username = userData.username;
        
        // Broadcast updated online users list
        const onlineUsers = getOnlineUsers();
        socket.server.emit('online-users-updated', onlineUsers);
        
        logger.info(`User ${userData.username} is now online (${userData.id})`);
      }
    } catch (error) {
      logger.error('Error handling user online:', error);
    }
  },

  /**
   * Handle user offline status
   */
  handleUserOffline: (socket, userId) => {
    try {
      const user = setUserOffline(userId);
      if (user) {
        // Broadcast updated online users list
        const onlineUsers = getOnlineUsers();
        socket.server.emit('online-users-updated', onlineUsers);
        
        logger.info(`User ${user.username} is now offline (${userId})`);
      }
    } catch (error) {
      logger.error('Error handling user offline:', error);
    }
  },

  /**
   * Handle call initiation
   */
  handleInitiateCall: (socket, callData) => {
    try {
      callController.handleInitiateCall(socket, socket.server, callData);
    } catch (error) {
      logger.error('Error handling call initiation:', error);
      socket.emit('call-error', { message: 'Failed to initiate call' });
    }
  },

  /**
   * Handle call acceptance
   */
  handleAcceptCall: (socket, callData) => {
    try {
      callController.handleAcceptCall(socket, socket.server, callData);
    } catch (error) {
      logger.error('Error handling call acceptance:', error);
      socket.emit('call-error', { message: 'Failed to accept call' });
    }
  },

  /**
   * Handle call rejection
   */
  handleRejectCall: (socket, callData) => {
    try {
      callController.handleRejectCall(socket, socket.server, callData);
    } catch (error) {
      logger.error('Error handling call rejection:', error);
    }
  },

  /**
   * Handle call ending
   */
  handleEndCall: (socket, callData) => {
    try {
      callController.handleEndCall(socket, socket.server, callData);
    } catch (error) {
      logger.error('Error handling call ending:', error);
    }
  },

  /**
   * Xử lý sự kiện signal cho WebRTC
   */
  handleSignal: (socket, data, redisClient) => {
    try {
      const userId = socket.data.userId || socket.id;
      const roomId = getRoomIdFromSocket(socket);
      
      if (!roomId) {
        logger.warn(`User ${userId} tried to send signal but not in any room`);
        socket.emit('signal-error', { message: 'Not in any room' });
        return;
      }
      
      if (!data || !data.signal) {
        logger.warn('Invalid signal data from user:', userId);
        socket.emit('signal-error', { message: 'Invalid signal data' });
        return;
      }
      
      // Log signal types for debugging
      const signalType = data.signal.type || 'unknown';
      logger.debug(`Broadcasting ${signalType} signal from user ${userId} in room ${roomId}`);
      
      // Broadcast signal to all other users in the room
      socket.to(roomId).emit('signal', {
        from: userId,
        signal: data.signal,
        timestamp: Date.now(),
        type: signalType
      });
      
      // Send acknowledgment back to sender
      socket.emit('signal-sent', {
        to: roomId,
        type: signalType,
        timestamp: Date.now()
      });
      
    } catch (error) {
      logger.error('Error handling signal:', error);
      socket.emit('signal-error', { message: 'Failed to process signal', error: error.message });
    }
  },

  /**
   * Xử lý ICE candidate riêng biệt để có kiểm soát tốt hơn
   */
  handleIceCandidate: (socket, data, redisClient) => {
    try {
      const userId = socket.data.userId || socket.id;
      const roomId = getRoomIdFromSocket(socket);
      
      if (!roomId) {
        logger.warn(`User ${userId} tried to send ICE candidate but not in any room`);
        return;
      }
      
      if (!data || !data.candidate) {
        logger.warn('Invalid ICE candidate data from user:', userId);
        return;
      }
      
      logger.debug(`Broadcasting ICE candidate from user ${userId} in room ${roomId}`);
      
      // Broadcast ICE candidate to all other users in the room
      socket.to(roomId).emit('ice-candidate', {
        from: userId,
        candidate: data.candidate,
        timestamp: Date.now()
      });
      
    } catch (error) {
      logger.error('Error handling ICE candidate:', error);
    }
  },

  /**
   * Xử lý tham gia phòng
   */
  handleJoinRoom: (socket, roomId, userId, redisClient) => {
    try {
      if (!roomId) {
        socket.emit('error', { message: 'Room ID is required' });
        return;
      }
      
      // Normalize Room ID to lowercase
      const normalizedRoomId = roomId.toLowerCase();
      
      // Lưu userId vào socket data
      socket.data.userId = userId || socket.id;
      
      // Rời khỏi phòng cũ nếu có
      const currentRoom = getRoomIdFromSocket(socket);
      if (currentRoom) {
        socket.leave(currentRoom);
        // NEW: Xóa prompt cũ khi người dùng rời phòng hoặc chuyển phòng
        userLastPrompt.delete(socket.data.userId);
      }
      
      // Tham gia phòng mới
      socket.join(normalizedRoomId);
      socketRooms.set(socket.id, normalizedRoomId);
      
      logger.info(`User ${socket.data.userId} joined room ${normalizedRoomId}`);
      
      // Thông báo cho các client khác trong phòng
      socket.to(normalizedRoomId).emit('user-joined', {
        userId: socket.data.userId,
        socketId: socket.id,
        timestamp: Date.now()
      });
      
      // Gửi danh sách người dùng hiện tại trong phòng
      const io = socket.server;
      const socketsInRoom = io.sockets.adapter.rooms.get(normalizedRoomId);
      
      if (socketsInRoom) {
        const users = [];
        socketsInRoom.forEach(socketId => {
          const client = io.sockets.sockets.get(socketId);
          if (client && client.data.userId) {
            users.push(client.data.userId);
          }
        });
        
        logger.info(`Sending room-users event: ${users.length} users in room ${normalizedRoomId}`);
        socket.emit('room-users', { roomId: normalizedRoomId, users });
        
        // Also notify the new user about existing users
        if (users.length > 1) {
          logger.info(`Multiple users in room, notifying about peer connection setup`);
        }
      }
    } catch (error) {
      logger.error('Error handling join room:', error);
      socket.emit('error', { message: 'Failed to join room', details: error.message });
    }
  },

  /**
   * Xử lý audio stream cho nhận diện giọng nói
   */
  handleAudioStream: async (socket, data, redisClient) => {
    try {
      const { audioData, language = 'vi' /*, initialPrompt = null */ } = data; // NEW: initialPrompt từ client sẽ không dùng nữa, server tự quản lý
      const userId = socket.data.userId || socket.id;

      if (!audioData) {
        logger.warn('Nhận được gói dữ liệu âm thanh rỗng từ user ', userId);
        return;
      }

      // console.log(`[HOP_DEBUG] Nhận audio từ client ${userId}, lang: ${language}, kiểu: ${typeof audioData}, chiều dài: ${audioData.length || (audioData.byteLength || 'không xác định')}`);

      let audioBufferChunk;
      if (audioData instanceof Uint8Array || Array.isArray(audioData) || Buffer.isBuffer(audioData) || typeof audioData === 'object') {
        audioBufferChunk = Buffer.from(audioData);
      } else {
        logger.error(`Định dạng âm thanh không hỗ trợ từ user ${userId}: ${typeof audioData}`);
        socket.emit('transcription-error', { error: 'Định dạng âm thanh không được hỗ trợ' });
        return;
      }

      if (audioBufferChunk.length === 0) {
        logger.debug('Audio chunk rỗng từ user ', userId);
        return; 
      }

      // Quan trọng: Cần làm rõ `speechService.addAudioChunk` có xử lý buffer theo user không,
      // hoặc `processAndClearBuffer` có cách nào để chỉ xử lý audio của user hiện tại không.
      // Nếu `speechService` dùng buffer toàn cục, logic timeout này có thể không hoạt động đúng khi có nhiều user.
      // Giả định hiện tại là `speechService` xử lý được điều này hoặc đây là môi trường single-user cho `speechService`.
      speechService.addAudioChunk(audioBufferChunk);

      if (userAudioTimers.has(userId)) {
          clearTimeout(userAudioTimers.get(userId));
      }

      const timerId = setTimeout(async () => {
          // NEW: Lấy initial_prompt từ userLastPrompt
          const currentInitialPrompt = userLastPrompt.get(userId) || null;
          logger.info(`Silence detected for user ${userId}, processing buffer with lang: ${language}, prompt: ${currentInitialPrompt ? 'yes' : 'no'}...`);
          // console.log(`[HOP_DEBUG] Phát hiện khoảng lặng, bắt đầu xử lý buffer cho user ${userId} (lang: ${language}, prompt: ${currentInitialPrompt ? currentInitialPrompt.substring(0,20) : 'null'})`);
          
          const result = await speechService.processAndClearBuffer(language, currentInitialPrompt);
          // console.log(`[HOP_DEBUG] Kết quả xử lý buffer cho user ${userId}: ${result ? JSON.stringify(result) : 'null'}`);
          
          userAudioTimers.delete(userId);

          if (result && result.text && !result.isEmpty) { // MODIFIED: Kiểm tra thêm result.text
              logger.info(`Transcription result for ${userId}: "${result.text}"`);
              
              // NEW: Cập nhật userLastPrompt
              let newPrompt = userLastPrompt.get(userId) || "";
              newPrompt += (newPrompt ? " " : "") + result.text.trim();
              const MAX_PROMPT_LENGTH = 250; // Giới hạn độ dài prompt
              if (newPrompt.length > MAX_PROMPT_LENGTH) {
                  newPrompt = newPrompt.substring(newPrompt.length - MAX_PROMPT_LENGTH);
              }
              userLastPrompt.set(userId, newPrompt);

              const transcriptionPayload = {
                  text: result.text,
                  language: result.language || language, // Ưu tiên ngôn ngữ từ kết quả ASR
                  confidence: result.confidence,
                  isFinal: true, 
                  inferenceTime: result.inferenceTime,
                  timestamp: result.timestamp || Date.now(),
                  source: result.source
              };
              socket.emit('transcription-result', transcriptionPayload);

              const roomId = getRoomIdFromSocket(socket);
              if (roomId) {
                  socket.to(roomId).emit('remote-transcription', {
                      userId: userId,
                      ...transcriptionPayload
                  });
              }

              // NEW: Tự động dịch sau khi có kết quả ASR
              try {
                  const sourceLangForTranslation = result.language || language || 'vi';
                  const targetLangForTranslation = sourceLangForTranslation === 'vi' ? 'en' : 'vi'; // Ví dụ: tự động đổi chiều dịch

                  logger.debug(`Auto-translating for user ${userId}: "${result.text.substring(0,30)}..." (${sourceLangForTranslation} -> ${targetLangForTranslation})`);
                  const translationResult = await translationService.translateText(
                      result.text, 
                      sourceLangForTranslation, 
                      targetLangForTranslation,
                      null // context for translation (có thể dùng currentInitialPrompt nếu muốn)
                  );

                  if (translationResult && typeof translationResult.text !== 'undefined') {
                      const translationPayload = {
                          originalText: result.text,
                          translatedText: translationResult.text,
                          sourceLang: translationResult.sourceLang || sourceLangForTranslation,
                          targetLang: translationResult.targetLang || targetLangForTranslation,
                          model: translationResult.model,
                          timestamp: Date.now(),
                          processingTimeMs: translationResult.processingTimeMs
                      };
                      socket.emit('translation-result', translationPayload);
                      if (roomId) {
                          socket.to(roomId).emit('remote-translation', {
                              userId: userId,
                              ...translationPayload
                          });
                      }
                      logger.debug(`Auto-translation for user ${userId} successful: "${translationResult.text.substring(0,30)}..."`);
                  } else if (translationResult && translationResult.error) {
                      logger.error(`Auto-translation service returned an error for "${result.text}":`, translationResult.error);
                      socket.emit('translation-error', {
                          error: 'Failed to auto-translate text',
                          details: translationResult.error,
                          model: translationResult.model
                      });
                  } else {
                      logger.warn(`Invalid or empty response from auto-translation service for text: "${result.text}"`);
                  }
              } catch (translateError) {
                  logger.error(`Error during auto-translation for "${result.text}":`, translateError);
                  socket.emit('translation-error', {
                      error: 'Failed to auto-translate text during process',
                      details: translateError.message
                  });
              }

          } else if (result && result.error) {
              logger.error(`Error processing audio buffer for ${userId}:`, result.error);
              socket.emit('transcription-error', {
                  error: 'Failed to process audio buffer',
                  details: result.error
              });
          } else if (!result || (result && result.isEmpty)) { // MODIFIED: Xử lý trường hợp result.isEmpty
              logger.info(`No significant result from processAndClearBuffer for ${userId}, likely buffer too short or only silence.`);
          }
      }, SILENCE_TIMEOUT_MS);

      userAudioTimers.set(userId, timerId);

    } catch (error) {
      const userId = socket.data ? (socket.data.userId || socket.id) : socket.id; 
      logger.error(`Error processing audio stream for user ${userId}:`, error);
      socket.emit('transcription-error', {
        error: 'Failed to process audio stream',
        details: error.message
      });
    }
  },

  /**
   * Xử lý yêu cầu dịch văn bản (vẫn giữ nếu client muốn dịch thủ công)
   */
  handleTranslateText: async (socket, data, redisClient) => {
    try {
      const { text, sourceLang = 'vi', targetLang = 'en', model_name = null, context = null } = data;
      const userId = socket.data.userId || socket.id;
      
      if (!text) {
        socket.emit('translation-error', { error: 'Text is required for translation' });
        return;
      }
      
      logger.debug(`Manual translation request for user ${userId}: "${text.substring(0,30)}..." (${sourceLang} -> ${targetLang}), model: ${model_name || 'default'}`);

      const translationResult = await translationService.translateText(text, sourceLang, targetLang, context);
      
      if (translationResult && translationResult.error) {
        logger.error('Translation service returned an error (manual):', translationResult.error);
        socket.emit('translation-error', {
          error: 'Failed to translate text (manual)',
          details: translationResult.error,
          model: translationResult.model
        });
        return;
      }

      if (translationResult && typeof translationResult.text !== 'undefined') {
        const translationPayload = {
          originalText: translationResult.originalText || text,
          translatedText: translationResult.text,
          sourceLang: translationResult.sourceLang || sourceLang,
          targetLang: translationResult.targetLang || targetLang,
          model: translationResult.model,
          timestamp: Date.now(),
          processingTimeMs: translationResult.processingTimeMs
        };
        socket.emit('translation-result', translationPayload);
        
        // NEW: Gửi cả bản dịch thủ công cho những người khác trong phòng nếu cần
        const roomId = getRoomIdFromSocket(socket);
        if (roomId) {
            socket.to(roomId).emit('remote-translation', {
                userId: userId,
                ...translationPayload
            });
        }
        logger.debug(`Manual translation for user ${userId} successful: "${translationResult.text.substring(0,30)}..."`);

      } else {
        logger.error('Invalid or empty response from translationService (manual) for text:', text);
        socket.emit('translation-error', {
          error: 'Failed to translate text (manual)',
          details: 'Received invalid or empty response from translation service'
        });
      }
    } catch (error) {
      const userId = socket.data ? (socket.data.userId || socket.id) : socket.id;
      logger.error(`Error in handleTranslateText (manual) for user ${userId}:`, error);
      socket.emit('translation-error', {
        error: 'Failed to translate text (manual)',
        details: error.message
      });
    }
  },

  /**
   * Xử lý khi người dùng ngắt kết nối
   */
  handleDisconnect: (socket, reason, redisClient) => {
    try {
      const userId = socket.data.userId || socket.id;
      logger.info(`User ${userId} disconnected. Reason: ${reason}`);
      
      // Xóa timer và prompt của user này
      if (userAudioTimers.has(userId)) {
        clearTimeout(userAudioTimers.get(userId));
        userAudioTimers.delete(userId);
      }
      userLastPrompt.delete(userId);
      
      // Thông báo cho những người khác trong phòng (nếu có)
      const roomId = getRoomIdFromSocket(socket);
      if (roomId) {
        socket.to(roomId).emit('user-left', { userId, socketId: socket.id });
        socketRooms.delete(socket.id); // Xóa socket khỏi map quản lý phòng
      }
      
      // TODO: Xử lý thêm dọn dẹp nếu cần (ví dụ: trong Redis)
    } catch (error) {
      logger.error('Error handling disconnect:', error);
    }
  },

  /**
   * Các xử lý khác (ví dụ: chat message, etc.) có thể thêm ở đây
   */
  handleChatMessage: (socket, messageData) => {
    try {
      const userId = socket.data.userId || socket.id;
      const roomId = getRoomIdFromSocket(socket);

      if (!roomId) {
        socket.emit('error', { message: 'You are not in a room to send messages' });
        return;
      }
      if (!messageData || !messageData.text) {
         socket.emit('error', { message: 'Message text is empty' });
        return;
      }

      const payload = {
        userId: userId,
        text: messageData.text,
        timestamp: Date.now()
      };
      
      // Gửi cho mọi người trong phòng, bao gồm cả người gửi
      socket.server.to(roomId).emit('chat-message', payload); 
      logger.debug(`User ${userId} sent chat message to room ${roomId}: "${messageData.text.substring(0,30)}..."`);

    } catch (error) {
      logger.error('Error handling chat message:', error);
       socket.emit('error', { message: 'Failed to send chat message', details: error.message });
    }
  },

  /**
   * Xử lý bật/tắt phụ đề
   */
  handleToggleSubtitles: async (socket, data, redisClient) => {
    try {
      const userId = socket.data.userId || socket.id;
      const roomId = getRoomIdFromSocket(socket);

      if (!roomId) {
        socket.emit('error', { message: 'You are not in a room' });
        return;
      }

      const { enabled } = data;
      
      // Lưu trạng thái phụ đề vào Redis
      const subtitlesKey = `room:${roomId}:subtitles`;
      await redisClient.set(subtitlesKey, JSON.stringify({ enabled: !!enabled }));
      
      // Broadcast cho tất cả client trong phòng
      socket.server.to(roomId).emit('subtitles_state_change', { 
        enabled: !!enabled 
      });
      
      logger.info(`Subtitles ${enabled ? 'enabled' : 'disabled'} for room ${roomId} by user ${userId}`);
    } catch (error) {
      logger.error('Error handling toggle subtitles:', error);
      socket.emit('error', { message: 'Failed to toggle subtitles', details: error.message });
    }
  },

  /**
   * Xử lý bật/tắt TTS
   */
  handleToggleTTS: async (socket, data, redisClient) => {
    try {
      const userId = socket.data.userId || socket.id;
      const roomId = getRoomIdFromSocket(socket);

      if (!roomId) {
        socket.emit('error', { message: 'You are not in a room' });
        return;
      }

      const { enabled } = data;
      
      // Lưu trạng thái TTS vào Redis
      const ttsKey = `room:${roomId}:tts`;
      await redisClient.set(ttsKey, JSON.stringify({ enabled: !!enabled }));
      
      // Broadcast cho tất cả client trong phòng
      socket.server.to(roomId).emit('tts_state_change', { 
        enabled: !!enabled 
      });
      
      logger.info(`TTS ${enabled ? 'enabled' : 'disabled'} for room ${roomId} by user ${userId}`);
    } catch (error) {
      logger.error('Error handling toggle TTS:', error);
      socket.emit('error', { message: 'Failed to toggle TTS', details: error.message });
    }
  },

  /**
   * Xử lý lấy trạng thái UI
   */
  handleGetUIState: async (socket, redisClient) => {
    try {
      const roomId = getRoomIdFromSocket(socket);

      if (!roomId) {
        socket.emit('error', { message: 'You are not in a room' });
        return;
      }
      
      // Lấy trạng thái từ Redis
      const subtitlesKey = `room:${roomId}:subtitles`;
      const ttsKey = `room:${roomId}:tts`;
      
      const [subtitlesData, ttsData] = await Promise.all([
        redisClient.get(subtitlesKey),
        redisClient.get(ttsKey)
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
      logger.error('Error getting UI state:', error);
      socket.emit('error', { message: 'Failed to get UI state', details: error.message });
    }
  },

  /**
   * Handle user login
   */
  handleUserLogin: (socket, userData, redisClient) => {
    try {
      const user = setUserOnline(userData.id);
      if (user) {
        socket.data.userId = userData.id;
        socket.data.username = userData.username;
        socket.data.avatar = userData.avatar;
        
        // Join user to their personal room for direct messaging
        socket.join(`user_${userData.id}`);
        
        // Broadcast updated online users list
        const onlineUsers = getOnlineUsers();
        socket.server.emit('online-users-updated', onlineUsers);
        
        logger.info(`User ${userData.username} logged in (${userData.id})`);
        
        // Send success response
        socket.emit('user-login-success', { user: userData, onlineUsers });
      }
    } catch (error) {
      logger.error('Error handling user login:', error);
      socket.emit('user-login-error', { message: 'Login failed', details: error.message });
    }
  },

  /**
   * Handle user logout
   */
  handleUserLogout: (socket, userId, redisClient) => {
    try {
      setUserOffline(userId);
      
      // Leave user's personal room
      socket.leave(`user_${userId}`);
      
      // Clear socket data
      delete socket.data.userId;
      delete socket.data.username;
      delete socket.data.avatar;
      
      // Broadcast updated online users list
      const onlineUsers = getOnlineUsers();
      socket.server.emit('online-users-updated', onlineUsers);
      
      logger.info(`User logged out (${userId})`);
      
      socket.emit('user-logout-success');
    } catch (error) {
      logger.error('Error handling user logout:', error);
      socket.emit('user-logout-error', { message: 'Logout failed', details: error.message });
    }
  },

  /**
   * Handle call initiation
   */
  handleCallUser: (socket, data, redisClient) => {
    try {
      const { targetUserId, roomId } = data;
      const callerId = socket.data.userId;
      const callerUsername = socket.data.username;
      const callerAvatar = socket.data.avatar;
      
      if (!callerId) {
        socket.emit('call-error', { message: 'User not authenticated' });
        return;
      }
      
      // Initiate call using call controller
      const callData = callController.initiateCall(callerId, targetUserId, roomId);
      
      if (callData) {
        // Send call invitation to target user
        socket.server.to(`user_${targetUserId}`).emit('incoming-call', {
          callId: callData.id,
          caller: {
            id: callerId,
            username: callerUsername,
            avatar: callerAvatar
          },
          roomId: roomId,
          timestamp: Date.now()
        });
        
        // Confirm call initiation to caller
        socket.emit('call-initiated', {
          callId: callData.id,
          targetUserId,
          roomId,
          status: 'pending'
        });
        
        logger.info(`Call initiated from ${callerId} to ${targetUserId}, room: ${roomId}`);
      } else {
        socket.emit('call-error', { message: 'Failed to initiate call' });
      }
    } catch (error) {
      logger.error('Error handling call user:', error);
      socket.emit('call-error', { message: 'Call initiation failed', details: error.message });
    }
  },

  /**
   * Handle call acceptance
   */
  handleCallAccepted: (socket, data, redisClient) => {
    try {
      const { callId, roomId } = data;
      const userId = socket.data.userId;
      
      if (!userId) {
        socket.emit('call-error', { message: 'User not authenticated' });
        return;
      }
      
      // Accept call using call controller
      const callData = callController.acceptCall(callId, userId);
      
      if (callData) {
        // Notify caller that call was accepted
        socket.server.to(`user_${callData.callerId}`).emit('call-accepted', {
          callId,
          roomId,
          acceptedBy: userId,
          timestamp: Date.now()
        });
        
        // Confirm acceptance to callee
        socket.emit('call-acceptance-confirmed', {
          callId,
          roomId,
          callerId: callData.callerId
        });
        
        logger.info(`Call ${callId} accepted by ${userId}`);
      } else {
        socket.emit('call-error', { message: 'Failed to accept call' });
      }
    } catch (error) {
      logger.error('Error handling call accepted:', error);
      socket.emit('call-error', { message: 'Call acceptance failed', details: error.message });
    }
  },

  /**
   * Handle call rejection
   */
  handleCallRejected: (socket, data, redisClient) => {
    try {
      const { callId } = data;
      const userId = socket.data.userId;
      
      if (!userId) {
        socket.emit('call-error', { message: 'User not authenticated' });
        return;
      }
      
      // Reject call using call controller
      const callData = callController.rejectCall(callId, userId);
      
      if (callData) {
        // Notify caller that call was rejected
        socket.server.to(`user_${callData.callerId}`).emit('call-rejected', {
          callId,
          rejectedBy: userId,
          timestamp: Date.now()
        });
        
        // Confirm rejection to callee
        socket.emit('call-rejection-confirmed', { callId });
        
        logger.info(`Call ${callId} rejected by ${userId}`);
      } else {
        socket.emit('call-error', { message: 'Failed to reject call' });
      }
    } catch (error) {
      logger.error('Error handling call rejected:', error);
      socket.emit('call-error', { message: 'Call rejection failed', details: error.message });
    }
  },

  /**
   * Handle call end
   */
  handleCallEnded: (socket, data, redisClient) => {
    try {
      const { callId, roomId } = data;
      const userId = socket.data.userId;
      
      if (!userId) {
        socket.emit('call-error', { message: 'User not authenticated' });
        return;
      }
      
      // End call using call controller
      const callData = callController.endCall(callId, userId);
      
      if (callData) {
        // Notify all participants that call ended
        const participants = [callData.callerId, callData.targetUserId];
        participants.forEach(participantId => {
          if (participantId !== userId) {
            socket.server.to(`user_${participantId}`).emit('call-ended', {
              callId,
              endedBy: userId,
              timestamp: Date.now()
            });
          }
        });
        
        // Confirm end to caller
        socket.emit('call-end-confirmed', { callId });
        
        logger.info(`Call ${callId} ended by ${userId}`);
      } else {
        socket.emit('call-error', { message: 'Failed to end call' });
      }
    } catch (error) {
      logger.error('Error handling call ended:', error);
      socket.emit('call-error', { message: 'Call end failed', details: error.message });
    }
  },

  /**
   * Handle user disconnect
   */
  handleUserDisconnect: (socket, redisClient) => {
    try {
      const userId = socket.data.userId;
      
      if (userId) {
        // Set user offline
        setUserOffline(userId);
        
        // End any active calls
        const activeCalls = callController.getActiveCallsForUser(userId);
        activeCalls.forEach(call => {
          callController.endCall(call.id, userId);
          
          // Notify other participants
          const otherParticipant = call.callerId === userId ? call.targetUserId : call.callerId;
          socket.server.to(`user_${otherParticipant}`).emit('call-ended', {
            callId: call.id,
            endedBy: userId,
            reason: 'disconnect',
            timestamp: Date.now()
          });
        });
        
        // Broadcast updated online users list
        const onlineUsers = getOnlineUsers();
        socket.server.emit('online-users-updated', onlineUsers);
        
        logger.info(`User ${userId} disconnected and set offline`);
      }
    } catch (error) {
      logger.error('Error handling user disconnect:', error);
    }
  },

  /**
   * Handle ICE candidate exchange
   */
  handleIceCandidate: (socket, data, redisClient) => {
    try {
      const userId = socket.data.userId || socket.id;
      const roomId = getRoomIdFromSocket(socket);
      
      if (!roomId) {
        logger.warn(`User ${userId} tried to send ICE candidate but not in any room`);
        return;
      }
      
      if (!data || !data.candidate) {
        logger.warn('Invalid ICE candidate data from user:', userId);
        return;
      }
      
      logger.debug(`Broadcasting ICE candidate from user ${userId} in room ${roomId}`);
      
      // Broadcast ICE candidate to all other users in the room
      socket.to(roomId).emit('ice-candidate', {
        from: userId,
        candidate: data.candidate,
        timestamp: Date.now()
      });
      
    } catch (error) {
      logger.error('Error handling ICE candidate:', error);
    }
  },
};

module.exports = socketController;
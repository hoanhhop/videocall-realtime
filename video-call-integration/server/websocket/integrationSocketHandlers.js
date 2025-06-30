const DatabaseAdapter = require('../adapters/DatabaseAdapter');
const jwt = require('jsonwebtoken');

/**
 * WebSocket handlers cho video call integration
 * Tích hợp với database taikhoan hiện có
 */
class IntegrationSocketHandlers {
  constructor(io) {
    this.io = io;
    this.db = new DatabaseAdapter();
    this.activeCalls = new Map(); // Map để track active calls
    this.userSockets = new Map(); // Map userId -> socketId
    this.socketUsers = new Map(); // Map socketId -> userId
    
    this.setupHandlers();
  }

  setupHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`Socket connected: ${socket.id}`);

      // Authentication khi connect
      socket.on('authenticate', async (data) => {
        await this.handleAuthentication(socket, data);
      });

      // Join video call room
      socket.on('join-video-call', async (data) => {
        await this.handleJoinVideoCall(socket, data);
      });

      // WebRTC signaling
      socket.on('offer', (data) => {
        this.handleWebRTCSignaling(socket, 'offer', data);
      });

      socket.on('answer', (data) => {
        this.handleWebRTCSignaling(socket, 'answer', data);
      });

      socket.on('ice-candidate', (data) => {
        this.handleWebRTCSignaling(socket, 'ice-candidate', data);
      });

      // Call management
      socket.on('accept-call', async (data) => {
        await this.handleAcceptCall(socket, data);
      });

      socket.on('reject-call', async (data) => {
        await this.handleRejectCall(socket, data);
      });

      socket.on('end-call', async (data) => {
        await this.handleEndCall(socket, data);
      });

      // Audio/Translation
      socket.on('audio-data', (data) => {
        this.handleAudioData(socket, data);
      });

      socket.on('translation-request', (data) => {
        this.handleTranslationRequest(socket, data);
      });

      // Chat messages
      socket.on('chat-message', (data) => {
        this.handleChatMessage(socket, data);
      });

      // Disconnect
      socket.on('disconnect', async () => {
        await this.handleDisconnect(socket);
      });
    });
  }

  /**
   * Handle user authentication
   */
  async handleAuthentication(socket, data) {
    try {
      const { token } = data;
      
      if (!token) {
        socket.emit('auth-error', { message: 'Token không được cung cấp' });
        return;
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'video-call-secret-key');
      const user = await this.db.getUserById(decoded.userId);

      if (!user) {
        socket.emit('auth-error', { message: 'User không tồn tại' });
        return;
      }

      // Lưu thông tin user vào socket
      socket.userId = user.id;
      socket.userInfo = {
        id: user.id,
        userCode: user.userCode,
        fullName: user.fullName,
        email: user.email,
        avatar: user.avatar
      };

      // Map socket với user
      this.userSockets.set(user.id, socket.id);
      this.socketUsers.set(socket.id, user.id);

      // Cập nhật trạng thái online
      await this.db.updateUserOnlineStatus(user.id, true, socket.id);

      // Thông báo authentication thành công
      socket.emit('authenticated', {
        user: socket.userInfo
      });

      // Broadcast user online status
      this.io.emit('user-online', {
        userId: user.id,
        userInfo: socket.userInfo
      });

      console.log(`User ${user.fullName} (${user.id}) authenticated`);

    } catch (error) {
      console.error('Authentication error:', error);
      socket.emit('auth-error', { message: 'Token không hợp lệ' });
    }
  }

  /**
   * Handle join video call room
   */
  async handleJoinVideoCall(socket, data) {
    try {
      if (!socket.userId) {
        socket.emit('error', { message: 'Chưa xác thực' });
        return;
      }

      const { roomId, sessionId } = data;
      
      // Verify session
      const session = await this.db.getVideoCallSession(sessionId);
      if (!session) {
        socket.emit('error', { message: 'Session không tồn tại' });
        return;
      }

      // Check permission
      if (session.caller_id !== socket.userId && session.callee_id !== socket.userId) {
        socket.emit('error', { message: 'Không có quyền tham gia cuộc gọi này' });
        return;
      }

      // Join room
      socket.join(roomId);
      socket.currentRoom = roomId;

      // Add to active calls
      if (!this.activeCalls.has(roomId)) {
        this.activeCalls.set(roomId, {
          sessionId,
          participants: new Set(),
          startTime: new Date()
        });
      }

      const call = this.activeCalls.get(roomId);
      call.participants.add(socket.userId);

      // Notify others in room
      socket.to(roomId).emit('user-joined', {
        userId: socket.userId,
        userInfo: socket.userInfo
      });

      // Send room info to user
      socket.emit('joined-room', {
        roomId,
        sessionId,
        participants: Array.from(call.participants)
      });

      console.log(`User ${socket.userId} joined room ${roomId}`);

    } catch (error) {
      console.error('Join video call error:', error);
      socket.emit('error', { message: 'Lỗi khi tham gia cuộc gọi' });
    }
  }

  /**
   * Handle WebRTC signaling
   */
  handleWebRTCSignaling(socket, type, data) {
    try {
      const { roomId, targetUserId, payload } = data;
      
      if (!socket.currentRoom || socket.currentRoom !== roomId) {
        socket.emit('error', { message: 'Không trong phòng gọi' });
        return;
      }

      // Forward signal to target user
      if (targetUserId) {
        const targetSocketId = this.userSockets.get(targetUserId);
        if (targetSocketId) {
          this.io.to(targetSocketId).emit(type, {
            fromUserId: socket.userId,
            payload
          });
        }
      } else {
        // Broadcast to room (excluding sender)
        socket.to(roomId).emit(type, {
          fromUserId: socket.userId,
          payload
        });
      }

    } catch (error) {
      console.error('WebRTC signaling error:', error);
    }
  }

  /**
   * Handle accept call
   */
  async handleAcceptCall(socket, data) {
    try {
      const { sessionId } = data;
      
      // Update session status
      await this.db.updateVideoCallSession(sessionId, 'active');

      // Get session info
      const session = await this.db.getVideoCallSessionByRoomId(data.roomId);
      
      // Notify caller
      const callerId = session.caller_id;
      const callerSocketId = this.userSockets.get(callerId);
      
      if (callerSocketId) {
        this.io.to(callerSocketId).emit('call-accepted', {
          sessionId,
          acceptedBy: socket.userInfo
        });
      }

      console.log(`Call ${sessionId} accepted by user ${socket.userId}`);

    } catch (error) {
      console.error('Accept call error:', error);
      socket.emit('error', { message: 'Lỗi khi chấp nhận cuộc gọi' });
    }
  }

  /**
   * Handle reject call
   */
  async handleRejectCall(socket, data) {
    try {
      const { sessionId } = data;
      
      // Update session status
      await this.db.updateVideoCallSession(sessionId, 'rejected');

      // Get session info
      const session = await this.db.getVideoCallSession(sessionId);
      
      // Notify caller
      const callerId = session.caller_id;
      const callerSocketId = this.userSockets.get(callerId);
      
      if (callerSocketId) {
        this.io.to(callerSocketId).emit('call-rejected', {
          sessionId,
          rejectedBy: socket.userInfo
        });
      }

      // Create notification
      await this.db.createNotification(callerId, 'call_rejected', {
        rejectedBy: socket.userInfo,
        sessionId
      });

      console.log(`Call ${sessionId} rejected by user ${socket.userId}`);

    } catch (error) {
      console.error('Reject call error:', error);
    }
  }

  /**
   * Handle end call
   */
  async handleEndCall(socket, data) {
    try {
      const { sessionId, roomId } = data;
      
      // Update session status
      await this.db.updateVideoCallSession(sessionId, 'ended');

      // Remove from active calls
      if (this.activeCalls.has(roomId)) {
        this.activeCalls.delete(roomId);
      }

      // Notify all participants
      socket.to(roomId).emit('call-ended', {
        sessionId,
        endedBy: socket.userInfo
      });

      // Leave room
      socket.leave(roomId);
      socket.currentRoom = null;

      console.log(`Call ${sessionId} ended by user ${socket.userId}`);

    } catch (error) {
      console.error('End call error:', error);
    }
  }

  /**
   * Handle audio data for translation
   */
  handleAudioData(socket, data) {
    try {
      const { roomId, audioData, language } = data;
      
      if (!socket.currentRoom || socket.currentRoom !== roomId) {
        return;
      }

      // Forward audio to translation service (mock for now)
      // In real implementation, send to ASR/Translation services
      socket.emit('audio-received', {
        success: true,
        message: 'Audio data received for processing'
      });

      // Mock translation result
      setTimeout(() => {
        socket.to(roomId).emit('translation-result', {
          originalText: 'Original speech text...',
          translatedText: 'Translated text...',
          sourceLanguage: language,
          targetLanguage: language === 'vi' ? 'en' : 'vi',
          fromUserId: socket.userId
        });
      }, 1000);

    } catch (error) {
      console.error('Audio data error:', error);
    }
  }

  /**
   * Handle translation request
   */
  handleTranslationRequest(socket, data) {
    try {
      const { roomId, text, sourceLanguage, targetLanguage } = data;
      
      if (!socket.currentRoom || socket.currentRoom !== roomId) {
        return;
      }

      // Mock translation (in real implementation, call translation service)
      setTimeout(() => {
        socket.emit('translation-result', {
          originalText: text,
          translatedText: `[Translated] ${text}`,
          sourceLanguage,
          targetLanguage,
          fromUserId: socket.userId
        });
      }, 500);

    } catch (error) {
      console.error('Translation request error:', error);
    }
  }

  /**
   * Handle chat message
   */
  handleChatMessage(socket, data) {
    try {
      const { roomId, message } = data;
      
      if (!socket.currentRoom || socket.currentRoom !== roomId) {
        return;
      }

      // Broadcast message to room
      this.io.to(roomId).emit('chat-message', {
        fromUserId: socket.userId,
        fromUser: socket.userInfo,
        message,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('Chat message error:', error);
    }
  }

  /**
   * Handle disconnect
   */
  async handleDisconnect(socket) {
    try {
      const userId = socket.userId;
      
      if (userId) {
        // Update offline status
        await this.db.updateUserOnlineStatus(userId, false);

        // Remove from maps
        this.userSockets.delete(userId);
        this.socketUsers.delete(socket.id);

        // Broadcast user offline
        this.io.emit('user-offline', { userId });

        // Handle active call cleanup
        if (socket.currentRoom) {
          const call = this.activeCalls.get(socket.currentRoom);
          if (call) {
            call.participants.delete(userId);
            
            // Notify others in room
            socket.to(socket.currentRoom).emit('user-left', {
              userId,
              userInfo: socket.userInfo
            });

            // If room is empty, remove it
            if (call.participants.size === 0) {
              this.activeCalls.delete(socket.currentRoom);
            }
          }
        }

        console.log(`User ${userId} disconnected`);
      }

    } catch (error) {
      console.error('Disconnect error:', error);
    }
  }
}

module.exports = IntegrationSocketHandlers;

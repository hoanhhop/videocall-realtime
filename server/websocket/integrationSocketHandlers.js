const DatabaseAdapter = require('../adapters/DatabaseAdapter');
const jwt = require('jsonwebtoken');

/**
 * WebSocket handlers cho integration features
 */
class IntegrationSocketHandlers {
  constructor(io) {
    this.io = io;
    this.db = new DatabaseAdapter();
    this.connectedUsers = new Map(); // userId -> socketId
    this.userSockets = new Map(); // socketId -> userId
    this.activeRooms = new Map(); // roomId -> {participants: Set, sessionId}
  }

  /**
   * Initialize socket handlers
   */
  initializeHandlers() {
    this.io.on('connection', (socket) => {
      console.log('New integration socket connection:', socket.id);

      // ==================== AUTHENTICATION ====================
      socket.on('authenticate', async (data) => {
        try {
          const { token } = data;
          
          if (!token) {
            socket.emit('authentication_error', { message: 'Token là bắt buộc' });
            return;
          }

          // Verify JWT token
          const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
          const user = await this.db.getUserById(decoded.userId);
          
          if (!user) {
            socket.emit('authentication_error', { message: 'User không tồn tại' });
            return;
          }

          // Store user info in socket
          socket.userId = user.id;
          socket.userInfo = user;

          // Update maps
          this.connectedUsers.set(user.id, socket.id);
          this.userSockets.set(socket.id, user.id);

          // Update user online status
          await this.db.updateUserOnlineStatus(user.id, true, socket.id);

          socket.emit('authenticated', { 
            user,
            message: 'Đã xác thực thành công' 
          });

          // Broadcast user online status to others
          socket.broadcast.emit('user_online', {
            userId: user.id,
            userInfo: user
          });

          console.log(`User ${user.fullName} (${user.id}) authenticated via integration`);

        } catch (error) {
          console.error('Authentication error:', error);
          socket.emit('authentication_error', { 
            message: 'Token không hợp lệ hoặc đã hết hạn' 
          });
        }
      });

      // ==================== VIDEO CALL EVENTS ====================
      
      /**
       * Gửi video call invitation
       */
      socket.on('send_call_invitation', async (data) => {
        try {
          if (!socket.userId) {
            socket.emit('error', { message: 'Chưa xác thực' });
            return;
          }

          const { calleeId, sessionId, roomId } = data;
          const calleeSocketId = this.connectedUsers.get(calleeId);

          if (!calleeSocketId) {
            socket.emit('call_invitation_failed', { 
              message: 'User được gọi hiện không online' 
            });
            return;
          }

          // Gửi invitation đến callee
          this.io.to(calleeSocketId).emit('incoming_call', {
            sessionId,
            roomId,
            callerId: socket.userId,
            callerInfo: socket.userInfo,
            timestamp: new Date().toISOString()
          });

          socket.emit('call_invitation_sent', { 
            calleeId, 
            sessionId, 
            roomId 
          });

        } catch (error) {
          console.error('Send call invitation error:', error);
          socket.emit('error', { message: 'Lỗi khi gửi lời mời gọi' });
        }
      });

      /**
       * Accept video call
       */
      socket.on('accept_call', async (data) => {
        try {
          if (!socket.userId) {
            socket.emit('error', { message: 'Chưa xác thực' });
            return;
          }

          const { sessionId, roomId, callerId } = data;
          const callerSocketId = this.connectedUsers.get(callerId);

          // Update session status
          await this.db.updateVideoCallSession(sessionId, 'active');

          // Join room
          socket.join(roomId);
          
          // Initialize room participants
          if (!this.activeRooms.has(roomId)) {
            this.activeRooms.set(roomId, {
              participants: new Set(),
              sessionId
            });
          }
          this.activeRooms.get(roomId).participants.add(socket.userId);

          // Notify caller
          if (callerSocketId) {
            this.io.to(callerSocketId).emit('call_accepted', {
              sessionId,
              roomId,
              calleeId: socket.userId,
              calleeInfo: socket.userInfo
            });
          }

          socket.emit('call_accepted_confirmation', {
            sessionId,
            roomId,
            message: 'Đã chấp nhận cuộc gọi'
          });

        } catch (error) {
          console.error('Accept call error:', error);
          socket.emit('error', { message: 'Lỗi khi chấp nhận cuộc gọi' });
        }
      });

      /**
       * Reject video call
       */
      socket.on('reject_call', async (data) => {
        try {
          if (!socket.userId) {
            socket.emit('error', { message: 'Chưa xác thực' });
            return;
          }

          const { sessionId, callerId } = data;
          const callerSocketId = this.connectedUsers.get(callerId);

          // Update session status
          await this.db.updateVideoCallSession(sessionId, 'rejected');

          // Notify caller
          if (callerSocketId) {
            this.io.to(callerSocketId).emit('call_rejected', {
              sessionId,
              calleeId: socket.userId,
              calleeInfo: socket.userInfo
            });
          }

          socket.emit('call_rejected_confirmation', {
            sessionId,
            message: 'Đã từ chối cuộc gọi'
          });

        } catch (error) {
          console.error('Reject call error:', error);
          socket.emit('error', { message: 'Lỗi khi từ chối cuộc gọi' });
        }
      });

      /**
       * Join video call room
       */
      socket.on('join_video_room', async (data) => {
        try {
          if (!socket.userId) {
            socket.emit('error', { message: 'Chưa xác thực' });
            return;
          }

          const { roomId } = data;
          
          // Join socket room
          socket.join(roomId);

          // Update active rooms
          if (!this.activeRooms.has(roomId)) {
            this.activeRooms.set(roomId, {
              participants: new Set(),
              sessionId: data.sessionId
            });
          }
          
          const room = this.activeRooms.get(roomId);
          room.participants.add(socket.userId);

          // Notify other participants
          socket.to(roomId).emit('user_joined_room', {
            userId: socket.userId,
            userInfo: socket.userInfo
          });

          // Send current participants to new user
          const participants = Array.from(room.participants)
            .filter(id => id !== socket.userId)
            .map(id => ({
              userId: id,
              socketId: this.connectedUsers.get(id)
            }));

          socket.emit('room_joined', {
            roomId,
            participants
          });

        } catch (error) {
          console.error('Join video room error:', error);
          socket.emit('error', { message: 'Lỗi khi tham gia phòng' });
        }
      });

      /**
       * Leave video call room
       */
      socket.on('leave_video_room', async (data) => {
        try {
          const { roomId } = data;
          
          socket.leave(roomId);

          if (this.activeRooms.has(roomId)) {
            const room = this.activeRooms.get(roomId);
            room.participants.delete(socket.userId);

            // Notify other participants
            socket.to(roomId).emit('user_left_room', {
              userId: socket.userId,
              userInfo: socket.userInfo
            });

            // If no participants left, clean up room
            if (room.participants.size === 0) {
              this.activeRooms.delete(roomId);
              
              // Update session status to ended
              if (room.sessionId) {
                await this.db.updateVideoCallSession(room.sessionId, 'ended');
              }
            }
          }

        } catch (error) {
          console.error('Leave video room error:', error);
        }
      });

      // ==================== WebRTC SIGNALING ====================
      
      /**
       * WebRTC offer
       */
      socket.on('webrtc_offer', (data) => {
        const { targetUserId, offer, roomId } = data;
        const targetSocketId = this.connectedUsers.get(targetUserId);
        
        if (targetSocketId) {
          this.io.to(targetSocketId).emit('webrtc_offer', {
            fromUserId: socket.userId,
            offer,
            roomId
          });
        }
      });

      /**
       * WebRTC answer
       */
      socket.on('webrtc_answer', (data) => {
        const { targetUserId, answer, roomId } = data;
        const targetSocketId = this.connectedUsers.get(targetUserId);
        
        if (targetSocketId) {
          this.io.to(targetSocketId).emit('webrtc_answer', {
            fromUserId: socket.userId,
            answer,
            roomId
          });
        }
      });

      /**
       * WebRTC ICE candidate
       */
      socket.on('webrtc_ice_candidate', (data) => {
        const { targetUserId, candidate, roomId } = data;
        const targetSocketId = this.connectedUsers.get(targetUserId);
        
        if (targetSocketId) {
          this.io.to(targetSocketId).emit('webrtc_ice_candidate', {
            fromUserId: socket.userId,
            candidate,
            roomId
          });
        }
      });

      // ==================== CHAT MESSAGES ====================
      
      /**
       * Send chat message in video call
       */
      socket.on('video_chat_message', (data) => {
        const { roomId, message, timestamp } = data;
        
        socket.to(roomId).emit('video_chat_message', {
          fromUserId: socket.userId,
          fromUserInfo: socket.userInfo,
          message,
          timestamp: timestamp || new Date().toISOString()
        });
      });

      // ==================== TRANSLATION EVENTS ====================
      
      /**
       * Send translation request
       */
      socket.on('translation_request', (data) => {
        const { roomId, text, sourceLanguage, targetLanguage } = data;
        
        // Broadcast to all participants in room
        socket.to(roomId).emit('translation_request', {
          fromUserId: socket.userId,
          text,
          sourceLanguage,
          targetLanguage,
          timestamp: new Date().toISOString()
        });
      });

      /**
       * Send translation result
       */
      socket.on('translation_result', (data) => {
        const { roomId, originalText, translatedText, sourceLanguage, targetLanguage } = data;
        
        // Broadcast to all participants in room
        socket.to(roomId).emit('translation_result', {
          fromUserId: socket.userId,
          originalText,
          translatedText,
          sourceLanguage,
          targetLanguage,
          timestamp: new Date().toISOString()
        });
      });

      // ==================== DISCONNECTION ====================
      
      socket.on('disconnect', async () => {
        try {
          const userId = this.userSockets.get(socket.id);
          
          if (userId) {
            // Update user offline status
            await this.db.updateUserOnlineStatus(userId, false);

            // Clean up maps
            this.connectedUsers.delete(userId);
            this.userSockets.delete(socket.id);

            // Clean up rooms
            for (const [roomId, room] of this.activeRooms.entries()) {
              if (room.participants.has(userId)) {
                room.participants.delete(userId);
                
                // Notify other participants
                socket.to(roomId).emit('user_left_room', {
                  userId,
                  reason: 'disconnected'
                });

                // If no participants left, clean up room
                if (room.participants.size === 0) {
                  this.activeRooms.delete(roomId);
                  
                  // Update session status
                  if (room.sessionId) {
                    await this.db.updateVideoCallSession(room.sessionId, 'ended');
                  }
                }
              }
            }

            // Broadcast user offline status
            socket.broadcast.emit('user_offline', { userId });

            console.log(`User ${userId} disconnected from integration`);
          }

        } catch (error) {
          console.error('Disconnect error:', error);
        }
      });

      // ==================== ERROR HANDLING ====================
      
      socket.on('error', (error) => {
        console.error('Socket error:', error);
      });
    });
  }

  /**
   * Send notification to specific user
   */
  async sendNotificationToUser(userId, type, data) {
    const socketId = this.connectedUsers.get(userId);
    if (socketId) {
      this.io.to(socketId).emit('notification', {
        type,
        data,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get online users count
   */
  getOnlineUsersCount() {
    return this.connectedUsers.size;
  }

  /**
   * Get active rooms count
   */
  getActiveRoomsCount() {
    return this.activeRooms.size;
  }
}

module.exports = IntegrationSocketHandlers;

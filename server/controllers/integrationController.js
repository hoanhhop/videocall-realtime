const DatabaseAdapter = require('../adapters/DatabaseAdapter');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

/**
 * Controller để tích hợp với website hiện có
 * Handles integration with existing website
 */
class IntegrationController {
  constructor() {
    this.db = new DatabaseAdapter();
  }

  /**
   * External authentication - cho phép website hiện có authenticate user
   * POST /api/integration/auth
   */
  async authenticate(req, res) {
    try {
      const { credential, password } = req.body;

      if (!credential || !password) {
        return res.status(400).json({
          success: false,
          message: 'Email/Mã tài khoản và mật khẩu là bắt buộc'
        });
      }

      // Authenticate user với database hiện có
      const user = await this.db.authenticateUser(credential, password);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Thông tin đăng nhập không chính xác'
        });
      }

      // Tạo JWT token
      const token = jwt.sign(
        { 
          userId: user.id,
          email: user.email,
          userCode: user.userCode 
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      // Cập nhật trạng thái online
      await this.db.updateUserOnlineStatus(user.id, true);

      res.json({
        success: true,
        data: {
          user,
          token,
          videoCallConfig: {
            serverUrl: process.env.VIDEO_CALL_SERVER_URL || 'https://34.142.175.163',
            socketUrl: process.env.SOCKET_SERVER_URL || 'https://34.142.175.163'
          }
        }
      });

    } catch (error) {
      console.error('Authentication error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi server trong quá trình xác thực'
      });
    }
  }

  /**
   * Verify token từ website hiện có
   * POST /api/integration/verify-token
   */
  async verifyToken(req, res) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json({
          success: false,
          message: 'Token là bắt buộc'
        });
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      // Lấy thông tin user mới nhất
      const user = await this.db.getUserById(decoded.userId);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User không tồn tại'
        });
      }

      res.json({
        success: true,
        data: {
          user,
          videoCallConfig: {
            serverUrl: process.env.VIDEO_CALL_SERVER_URL || 'https://34.142.175.163',
            socketUrl: process.env.SOCKET_SERVER_URL || 'https://34.142.175.163'
          }
        }
      });

    } catch (error) {
      console.error('Token verification error:', error);
      res.status(401).json({
        success: false,
        message: 'Token không hợp lệ hoặc đã hết hạn'
      });
    }
  }

  /**
   * Lấy danh sách users có thể gọi video call
   * GET /api/integration/users/available
   */
  async getAvailableUsers(req, res) {
    try {
      const userId = req.user.userId;
      const users = await this.db.getAvailableUsers(userId);

      res.json({
        success: true,
        data: users
      });

    } catch (error) {
      console.error('Get available users error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy danh sách users'
      });
    }
  }

  /**
   * Khởi tạo video call
   * POST /api/integration/video-call/initiate
   */
  async initiateVideoCall(req, res) {
    try {
      const callerId = req.user.userId;
      const { calleeId } = req.body;

      if (!calleeId) {
        return res.status(400).json({
          success: false,
          message: 'Callee ID là bắt buộc'
        });
      }

      // Kiểm tra callee có tồn tại
      const callee = await this.db.getUserById(calleeId);
      if (!callee) {
        return res.status(404).json({
          success: false,
          message: 'User được gọi không tồn tại'
        });
      }

      // Kiểm tra callee có online không
      const calleeStatus = await this.db.getUserOnlineStatus(calleeId);
      if (!calleeStatus || !calleeStatus.is_online) {
        return res.status(400).json({
          success: false,
          message: 'User được gọi hiện không online'
        });
      }

      // Tạo room ID unique
      const roomId = uuidv4();

      // Tạo video call session
      const sessionId = await this.db.createVideoCallSession(callerId, calleeId, roomId);

      // Lấy thông tin caller
      const caller = await this.db.getUserById(callerId);

      // Tạo notification cho callee
      await this.db.createNotification(calleeId, 'incoming_call', {
        sessionId,
        roomId,
        callerId,
        callerName: caller.fullName,
        callerAvatar: caller.avatar
      });

      res.json({
        success: true,
        data: {
          sessionId,
          roomId,
          callee: {
            id: callee.id,
            name: callee.fullName,
            avatar: callee.avatar
          },
          videoCallUrl: `https://34.142.175.163/video-call/${roomId}`
        }
      });

    } catch (error) {
      console.error('Initiate video call error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi khởi tạo video call'
      });
    }
  }

  /**
   * Join video call room
   * POST /api/integration/video-call/join
   */
  async joinVideoCall(req, res) {
    try {
      const userId = req.user.userId;
      const { roomId } = req.body;

      if (!roomId) {
        return res.status(400).json({
          success: false,
          message: 'Room ID là bắt buộc'
        });
      }

      // Lấy thông tin session
      const session = await this.db.getVideoCallSessionByRoomId(roomId);
      
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Video call session không tồn tại'
        });
      }

      // Kiểm tra user có quyền join không
      if (session.caller_id !== userId && session.callee_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền tham gia cuộc gọi này'
        });
      }

      // Cập nhật session status nếu đang pending
      if (session.status === 'pending') {
        await this.db.updateVideoCallSession(session.id, 'active');
      }

      res.json({
        success: true,
        data: {
          sessionId: session.id,
          roomId,
          videoCallUrl: `https://34.142.175.163/video-call/${roomId}`,
          otherParty: {
            id: session.caller_id === userId ? session.callee_id : session.caller_id,
            name: session.caller_id === userId ? session.calleeName : session.callerName,
            avatar: session.caller_id === userId ? session.calleeAvatar : session.callerAvatar
          }
        }
      });

    } catch (error) {
      console.error('Join video call error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi tham gia video call'
      });
    }
  }

  /**
   * End video call
   * POST /api/integration/video-call/end
   */
  async endVideoCall(req, res) {
    try {
      const userId = req.user.userId;
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({
          success: false,
          message: 'Session ID là bắt buộc'
        });
      }

      // Lấy thông tin session
      const session = await this.db.getVideoCallSession(sessionId);
      
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Video call session không tồn tại'
        });
      }

      // Kiểm tra user có quyền end không
      if (session.caller_id !== userId && session.callee_id !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền kết thúc cuộc gọi này'
        });
      }

      // Cập nhật session status
      await this.db.updateVideoCallSession(sessionId, 'ended');

      // Tạo notification cho user kia
      const otherUserId = session.caller_id === userId ? session.callee_id : session.caller_id;
      await this.db.createNotification(otherUserId, 'call_ended', {
        sessionId,
        endedBy: userId
      });

      res.json({
        success: true,
        message: 'Video call đã kết thúc'
      });

    } catch (error) {
      console.error('End video call error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi kết thúc video call'
      });
    }
  }

  /**
   * Lấy notifications của user
   * GET /api/integration/notifications
   */
  async getNotifications(req, res) {
    try {
      const userId = req.user.userId;
      const notifications = await this.db.getUnreadNotifications(userId);

      res.json({
        success: true,
        data: notifications
      });

    } catch (error) {
      console.error('Get notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy notifications'
      });
    }
  }

  /**
   * Đánh dấu notification đã đọc
   * POST /api/integration/notifications/:id/read
   */
  async markNotificationAsRead(req, res) {
    try {
      const { id } = req.params;
      await this.db.markNotificationAsRead(id);

      res.json({
        success: true,
        message: 'Notification đã được đánh dấu đã đọc'
      });

    } catch (error) {
      console.error('Mark notification as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật notification'
      });
    }
  }

  /**
   * Lấy lịch hẹn sắp tới (tích hợp với bảng cuochen)
   * GET /api/integration/appointments/upcoming
   */
  async getUpcomingAppointments(req, res) {
    try {
      const userId = req.user.userId;
      const appointments = await this.db.getUpcomingAppointments(userId);

      res.json({
        success: true,
        data: appointments
      });

    } catch (error) {
      console.error('Get upcoming appointments error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy lịch hẹn'
      });
    }
  }
}

module.exports = IntegrationController;

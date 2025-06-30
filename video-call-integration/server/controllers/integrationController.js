const DatabaseAdapter = require('../adapters/DatabaseAdapter');
const AuthMiddleware = require('../middleware/authMiddleware');
const { v4: uuidv4 } = require('uuid');

/**
 * Controller để tích hợp video call với database hiện có
 * Sử dụng bảng taikhoan và cuochen
 */
class IntegrationController {
  constructor() {
    this.db = new DatabaseAdapter();
    this.auth = new AuthMiddleware();
  }

  /**
   * Authentication cho video call integration
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

      // Authenticate user với bảng taikhoan
      const user = await this.db.authenticateUser(credential, password);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Thông tin đăng nhập không chính xác'
        });
      }

      // Tạo JWT token
      const token = this.auth.generateToken(user);

      // Cập nhật trạng thái online
      await this.db.updateUserOnlineStatus(user.id, true);

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            userCode: user.userCode,
            fullName: user.fullName,
            email: user.email,
            avatar: user.avatar,
            phone: user.phone
          },
          token,
          config: {
            serverUrl: process.env.VIDEO_CALL_SERVER_URL || 'http://localhost:8080',
            socketUrl: process.env.SOCKET_SERVER_URL || 'http://localhost:8080'
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
   * Verify token
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

      // Verify token qua middleware
      const decoded = require('jsonwebtoken').verify(token, this.auth.jwtSecret);
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
          user: {
            id: user.id,
            userCode: user.userCode,
            fullName: user.fullName,
            email: user.email,
            avatar: user.avatar
          },
          valid: true
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
      const currentUserId = req.user.userId;
      const users = await this.db.getAvailableUsers(currentUserId);

      res.json({
        success: true,
        data: {
          users: users.map(user => ({
            id: user.id,
            userCode: user.userCode,
            fullName: user.fullName,
            email: user.email,
            avatar: user.avatar,
            isOnline: Boolean(user.isOnline),
            lastSeen: user.lastSeen
          })),
          total: users.length
        }
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
   * Initiate video call
   * POST /api/integration/video-call/initiate
   */
  async initiateVideoCall(req, res) {
    try {
      const { calleeId } = req.body;
      const callerId = req.user.userId;

      if (!calleeId) {
        return res.status(400).json({
          success: false,
          message: 'ID người được gọi là bắt buộc'
        });
      }

      if (callerId === calleeId) {
        return res.status(400).json({
          success: false,
          message: 'Không thể gọi cho chính mình'
        });
      }

      // Kiểm tra callee tồn tại
      const callee = await this.db.getUserById(calleeId);
      if (!callee) {
        return res.status(404).json({
          success: false,
          message: 'Người được gọi không tồn tại'
        });
      }

      // Tạo room ID unique
      const roomId = `call_${callerId}_${calleeId}_${Date.now()}`;
      
      // Tạo video call session
      const sessionId = await this.db.createVideoCallSession(callerId, calleeId, roomId);

      // Tạo notification cho callee
      await this.db.createNotification(calleeId, 'incoming_call', {
        callerId,
        callerName: req.user.fullName,
        callerAvatar: req.user.avatar,
        roomId,
        sessionId
      });

      res.json({
        success: true,
        data: {
          sessionId,
          roomId,
          callee: {
            id: callee.id,
            fullName: callee.fullName,
            avatar: callee.avatar
          }
        }
      });

    } catch (error) {
      console.error('Initiate video call error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi khởi tạo cuộc gọi video'
      });
    }
  }

  /**
   * Lấy thông tin video call session
   * GET /api/integration/video-call/session/:sessionId
   */
  async getVideoCallSession(req, res) {
    try {
      const { sessionId } = req.params;
      const session = await this.db.getVideoCallSession(sessionId);

      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session không tồn tại'
        });
      }

      // Kiểm tra quyền truy cập
      if (session.caller_id !== req.user.userId && session.callee_id !== req.user.userId) {
        return res.status(403).json({
          success: false,
          message: 'Không có quyền truy cập session này'
        });
      }

      res.json({
        success: true,
        data: session
      });

    } catch (error) {
      console.error('Get video call session error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thông tin session'
      });
    }
  }

  /**
   * Cập nhật trạng thái video call
   * PUT /api/integration/video-call/session/:sessionId/status
   */
  async updateVideoCallStatus(req, res) {
    try {
      const { sessionId } = req.params;
      const { status } = req.body;

      if (!['active', 'ended', 'rejected'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Trạng thái không hợp lệ'
        });
      }

      const success = await this.db.updateVideoCallSession(sessionId, status);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'Session không tồn tại'
        });
      }

      res.json({
        success: true,
        message: 'Cập nhật trạng thái thành công'
      });

    } catch (error) {
      console.error('Update video call status error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi cập nhật trạng thái'
      });
    }
  }

  /**
   * Lấy notifications chưa đọc
   * GET /api/integration/notifications/unread
   */
  async getUnreadNotifications(req, res) {
    try {
      const userId = req.user.userId;
      const notifications = await this.db.getUnreadNotifications(userId);

      res.json({
        success: true,
        data: {
          notifications,
          count: notifications.length
        }
      });

    } catch (error) {
      console.error('Get unread notifications error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thông báo'
      });
    }
  }

  /**
   * Đánh dấu notification đã đọc
   * PUT /api/integration/notifications/:notificationId/read
   */
  async markNotificationAsRead(req, res) {
    try {
      const { notificationId } = req.params;
      await this.db.markNotificationAsRead(notificationId);

      res.json({
        success: true,
        message: 'Đánh dấu đã đọc thành công'
      });

    } catch (error) {
      console.error('Mark notification as read error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi đánh dấu thông báo'
      });
    }
  }

  /**
   * Lấy cuộc hẹn sắp tới (nếu có tích hợp với bảng cuochen)
   * GET /api/integration/appointments/upcoming
   */
  async getUpcomingAppointments(req, res) {
    try {
      const userId = req.user.userId;
      const appointments = await this.db.getUpcomingAppointments(userId);

      res.json({
        success: true,
        data: {
          appointments: appointments.map(apt => ({
            id: apt.id,
            otherPartyId: apt.otherPartyId,
            otherPartyName: apt.otherPartyName,
            appointmentTime: apt.appointment_time,
            status: apt.status,
            notes: apt.notes
          })),
          count: appointments.length
        }
      });

    } catch (error) {
      console.error('Get upcoming appointments error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy lịch hẹn'
      });
    }
  }

  /**
   * Get current user info
   * GET /api/integration/user/profile
   */
  async getUserProfile(req, res) {
    try {
      const userId = req.user.userId;
      const user = await this.db.getUserById(userId);

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User không tồn tại'
        });
      }

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            userCode: user.userCode,
            fullName: user.fullName,
            email: user.email,
            phone: user.phone,
            avatar: user.avatar,
            birthDate: user.birthDate,
            gender: user.gender
          }
        }
      });

    } catch (error) {
      console.error('Get user profile error:', error);
      res.status(500).json({
        success: false,
        message: 'Lỗi khi lấy thông tin user'
      });
    }
  }

  /**
   * Health check endpoint
   * GET /api/integration/health
   */
  async healthCheck(req, res) {
    try {
      // Test database connection
      const connection = await this.db.getConnection();
      await connection.ping();
      await connection.end();

      res.json({
        success: true,
        data: {
          status: 'healthy',
          timestamp: new Date().toISOString(),
          database: 'connected'
        }
      });

    } catch (error) {
      console.error('Health check error:', error);
      res.status(500).json({
        success: false,
        message: 'Service không khỏe mạnh',
        error: error.message
      });
    }
  }
}

module.exports = IntegrationController;

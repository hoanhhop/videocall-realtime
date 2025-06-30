const jwt = require('jsonwebtoken');
const DatabaseAdapter = require('../adapters/DatabaseAdapter');

/**
 * Middleware xác thực cho integration với website hiện có
 */
class AuthMiddleware {
  constructor() {
    this.db = new DatabaseAdapter();
  }

  /**
   * Verify JWT token từ website hiện có
   */
  async verifyToken(req, res, next) {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '') || 
                   req.header('x-auth-token') ||
                   req.body.token ||
                   req.query.token;

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Access token không được cung cấp'
        });
      }

      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      
      // Lấy thông tin user từ database
      const user = await this.db.getUserById(decoded.userId);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User không tồn tại'
        });
      }

      // Thêm user info vào request
      req.user = {
        userId: user.id,
        userCode: user.userCode,
        email: user.email,
        fullName: user.fullName,
        avatar: user.avatar
      };

      next();
    } catch (error) {
      console.error('Token verification error:', error);
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token đã hết hạn'
        });
      }
      
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Token không hợp lệ'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Lỗi server trong quá trình xác thực'
      });
    }
  }

  /**
   * Middleware để validate request body
   */
  validateRequest(requiredFields) {
    return (req, res, next) => {
      const missingFields = [];
      
      for (const field of requiredFields) {
        if (!req.body[field]) {
          missingFields.push(field);
        }
      }

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Thiếu các trường bắt buộc: ${missingFields.join(', ')}`
        });
      }

      next();
    };
  }

  /**
   * Middleware để check user online status
   */
  async checkOnlineStatus(req, res, next) {
    try {
      const userId = req.user.userId;
      const onlineStatus = await this.db.getUserOnlineStatus(userId);
      
      if (!onlineStatus || !onlineStatus.is_online) {
        // Cập nhật trạng thái online
        await this.db.updateUserOnlineStatus(userId, true);
      }

      next();
    } catch (error) {
      console.error('Check online status error:', error);
      // Không block request nếu có lỗi
      next();
    }
  }

  /**
   * Error handler middleware
   */
  errorHandler(err, req, res, next) {
    console.error('API Error:', err);

    // Mongoose validation error
    if (err.name === 'ValidationError') {
      const errors = Object.values(err.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        errors
      });
    }

    // Duplicate key error
    if (err.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu đã tồn tại'
      });
    }

    // MySQL errors
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        success: false,
        message: 'Bảng database không tồn tại'
      });
    }

    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu đã tồn tại'
      });
    }

    // Default error
    res.status(500).json({
      success: false,
      message: 'Lỗi server không xác định'
    });
  }

  /**
   * CORS middleware for integration
   */
  corsHandler(req, res, next) {
    // Cho phép multiple origins cho integration
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://yourdomain.com',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }

    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-auth-token');
    res.setHeader('Access-Control-Allow-Credentials', true);

    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }

    next();
  }
}

module.exports = AuthMiddleware;

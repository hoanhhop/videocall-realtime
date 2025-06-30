const jwt = require('jsonwebtoken');
const DatabaseAdapter = require('../adapters/DatabaseAdapter');

/**
 * Middleware xác thực cho video call integration
 * Tương thích với database taikhoan hiện có
 */
class AuthMiddleware {
  constructor() {
    this.db = new DatabaseAdapter();
    this.jwtSecret = process.env.JWT_SECRET || 'video-call-secret-key';
  }

  /**
   * Verify JWT token từ client
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
      const decoded = jwt.verify(token, this.jwtSecret);
      
      // Lấy thông tin user từ bảng taikhoan
      const user = await this.db.getUserById(decoded.userId);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User không tồn tại hoặc đã bị vô hiệu hóa'
        });
      }

      // Thêm user info vào request
      req.user = {
        userId: user.id,
        userCode: user.userCode,
        email: user.email,
        fullName: user.fullName,
        avatar: user.avatar,
        phone: user.phone
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
   * Tạo JWT token cho user (cho login)
   */
  generateToken(user) {
    const payload = {
      userId: user.id,
      email: user.email,
      userCode: user.userCode
    };

    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: '24h'
    });
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
   * Optional authentication - cho phép cả user đã đăng nhập và chưa đăng nhập
   */
  async optionalAuth(req, res, next) {
    try {
      const token = req.header('Authorization')?.replace('Bearer ', '') || 
                   req.header('x-auth-token');

      if (token) {
        const decoded = jwt.verify(token, this.jwtSecret);
        const user = await this.db.getUserById(decoded.userId);
        
        if (user) {
          req.user = {
            userId: user.id,
            userCode: user.userCode,
            email: user.email,
            fullName: user.fullName,
            avatar: user.avatar
          };
        }
      }

      next();
    } catch (error) {
      // Ignore errors in optional auth
      next();
    }
  }

  /**
   * CORS middleware for integration
   */
  corsHandler(req, res, next) {
    // Cho phép multiple origins cho integration
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'https://34.142.175.163',
      'https://yourdomain.com',
      process.env.FRONTEND_URL
    ].filter(Boolean);

    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      // Fallback for development
      res.setHeader('Access-Control-Allow-Origin', '*');
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

  /**
   * Error handler middleware
   */
  errorHandler(err, req, res, next) {
    console.error('API Error:', err);

    // MySQL errors
    if (err.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        success: false,
        message: 'Bảng database không tồn tại. Vui lòng chạy setup database.'
      });
    }

    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu đã tồn tại'
      });
    }

    if (err.code === 'ECONNREFUSED') {
      return res.status(500).json({
        success: false,
        message: 'Không thể kết nối database'
      });
    }

    // JWT errors
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token không hợp lệ'
      });
    }

    // Validation errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Dữ liệu không hợp lệ',
        details: err.message
      });
    }

    // Default error
    res.status(500).json({
      success: false,
      message: 'Lỗi server không xác định',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }

  /**
   * Rate limiting middleware (simple implementation)
   */
  rateLimit(windowMs = 15 * 60 * 1000, max = 100) {
    const requests = new Map();

    return (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean old requests
      if (requests.has(ip)) {
        const userRequests = requests.get(ip).filter(time => time > windowStart);
        requests.set(ip, userRequests);
      }

      const userRequests = requests.get(ip) || [];
      
      if (userRequests.length >= max) {
        return res.status(429).json({
          success: false,
          message: 'Quá nhiều requests. Vui lòng thử lại sau.'
        });
      }

      userRequests.push(now);
      requests.set(ip, userRequests);
      next();
    };
  }
}

module.exports = AuthMiddleware;

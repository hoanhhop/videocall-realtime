const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import routes và handlers
const integrationRoutes = require('./routes/integrationRoutes');
const IntegrationSocketHandlers = require('./websocket/integrationSocketHandlers');
const DatabaseAdapter = require('./adapters/DatabaseAdapter');

/**
 * Integration Server để deploy trên VM
 * Server tích hợp cho video call translation system
 */
class IntegrationServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = new Server(this.server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS ? 
               process.env.ALLOWED_ORIGINS.split(',') : 
               ["http://localhost:3000", "https://your-website.com"],
        methods: ["GET", "POST"],
        credentials: true
      },
      transports: ['websocket', 'polling']
    });
    
    this.db = new DatabaseAdapter();
    this.socketHandlers = new IntegrationSocketHandlers(this.io);
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupWebSocket();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS ? 
              process.env.ALLOWED_ORIGINS.split(',') : 
              ["http://localhost:3000", "https://your-website.com"],
      credentials: true,
      optionsSuccessStatus: 200
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });

    // Security headers
    this.app.use((req, res, next) => {
      res.header('X-Content-Type-Options', 'nosniff');
      res.header('X-Frame-Options', 'DENY');
      res.header('X-XSS-Protection', '1; mode=block');
      res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
      next();
    });

    // Static files for video call UI
    this.app.use('/static', express.static(path.join(__dirname, 'public')));
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        onlineUsers: this.socketHandlers.getOnlineUsersCount(),
        activeRooms: this.socketHandlers.getActiveRoomsCount()
      });
    });

    // API routes
    this.app.use('/api/integration', integrationRoutes);

    // Video call page
    this.app.get('/video-call/:roomId', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'video-call.html'));
    });

    // Default route
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Video Call Translation Integration Server',
        version: process.env.npm_package_version || '1.0.0',
        docs: '/api/docs',
        health: '/health'
      });
    });

    // API documentation
    this.app.get('/api/docs', (req, res) => {
      res.json({
        title: 'Video Call Translation Integration API',
        version: '1.0.0',
        baseUrl: req.protocol + '://' + req.get('host'),
        endpoints: {
          authentication: {
            'POST /api/integration/auth': 'Authenticate user with existing credentials',
            'POST /api/integration/verify-token': 'Verify JWT token'
          },
          users: {
            'GET /api/integration/users/available': 'Get available users for video call'
          },
          videoCall: {
            'POST /api/integration/video-call/initiate': 'Initiate video call',
            'POST /api/integration/video-call/join': 'Join video call room',
            'POST /api/integration/video-call/end': 'End video call'
          },
          notifications: {
            'GET /api/integration/notifications': 'Get user notifications',
            'POST /api/integration/notifications/:id/read': 'Mark notification as read'
          },
          appointments: {
            'GET /api/integration/appointments/upcoming': 'Get upcoming appointments'
          }
        },
        websocket: {
          url: req.protocol.replace('http', 'ws') + '://' + req.get('host'),
          events: {
            client: [
              'authenticate',
              'send_call_invitation',
              'accept_call',
              'reject_call',
              'join_video_room',
              'leave_video_room',
              'webrtc_offer',
              'webrtc_answer',
              'webrtc_ice_candidate',
              'video_chat_message',
              'translation_request',
              'translation_result'
            ],
            server: [
              'authenticated',
              'authentication_error',
              'incoming_call',
              'call_accepted',
              'call_rejected',
              'user_joined_room',
              'user_left_room',
              'webrtc_offer',
              'webrtc_answer',
              'webrtc_ice_candidate',
              'video_chat_message',
              'translation_request',
              'translation_result',
              'user_online',
              'user_offline',
              'notification'
            ]
          }
        }
      });
    });
  }

  /**
   * Setup WebSocket handlers
   */
  setupWebSocket() {
    this.socketHandlers.initializeHandlers();
    
    console.log('WebSocket handlers initialized');
  }

  /**
   * Setup error handling
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        success: false,
        message: 'Endpoint không tồn tại',
        path: req.originalUrl
      });
    });

    // Global error handler
    this.app.use((err, req, res, next) => {
      console.error('Global error handler:', err);
      
      res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
      });
    });

    // Process error handlers
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.gracefulShutdown('UNCAUGHT_EXCEPTION');
    });

    process.on('unhandledRejection', (reason, promise) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason);
      this.gracefulShutdown('UNHANDLED_REJECTION');
    });

    // Graceful shutdown
    process.on('SIGTERM', () => this.gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => this.gracefulShutdown('SIGINT'));
  }

  /**
   * Initialize database
   */
  async initializeDatabase() {
    try {
      console.log('Initializing database...');
      
      // Tạo bảng cần thiết nếu chưa tồn tại
      const connection = await this.db.getConnection();
      
      // Tạo bảng user_online_status
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS user_online_status (
          user_id INT PRIMARY KEY,
          is_online BOOLEAN DEFAULT FALSE,
          last_seen TIMESTAMP NULL,
          socket_id VARCHAR(255),
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES taikhoan(Id) ON DELETE CASCADE
        )
      `);

      // Tạo bảng video_call_sessions
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS video_call_sessions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          caller_id INT NOT NULL,
          callee_id INT NOT NULL,
          room_id VARCHAR(255) NOT NULL UNIQUE,
          status ENUM('pending', 'active', 'ended', 'rejected') DEFAULT 'pending',
          started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          ended_at TIMESTAMP NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          FOREIGN KEY (caller_id) REFERENCES taikhoan(Id) ON DELETE CASCADE,
          FOREIGN KEY (callee_id) REFERENCES taikhoan(Id) ON DELETE CASCADE,
          INDEX idx_room_id (room_id),
          INDEX idx_status (status),
          INDEX idx_caller_id (caller_id),
          INDEX idx_callee_id (callee_id)
        )
      `);

      // Tạo bảng call_notifications
      await connection.execute(`
        CREATE TABLE IF NOT EXISTS call_notifications (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          type VARCHAR(50) NOT NULL,
          data JSON,
          is_read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES taikhoan(Id) ON DELETE CASCADE,
          INDEX idx_user_id (user_id),
          INDEX idx_is_read (is_read),
          INDEX idx_created_at (created_at)
        )
      `);

      await connection.end();
      console.log('Database initialized successfully');
      
    } catch (error) {
      console.error('Database initialization error:', error);
      throw error;
    }
  }

  /**
   * Start server
   */
  async start() {
    try {
      // Initialize database
      await this.initializeDatabase();

      const PORT = process.env.PORT || 3001;
      const HOST = process.env.HOST || '0.0.0.0';

      this.server.listen(PORT, HOST, () => {
        console.log(`
==============================================
🚀 Integration Server Started Successfully
==============================================
🌐 Server URL: http://${HOST}:${PORT}
📚 API Docs: http://${HOST}:${PORT}/api/docs
❤️  Health Check: http://${HOST}:${PORT}/health
🔌 WebSocket: ws://${HOST}:${PORT}
📱 Video Call: http://${HOST}:${PORT}/video-call/:roomId
==============================================
Environment: ${process.env.NODE_ENV || 'development'}
Database: ${process.env.DB_NAME || 'hommy_database'}
==============================================
        `);
      });

    } catch (error) {
      console.error('Failed to start server:', error);
      process.exit(1);
    }
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown(signal) {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
    
    try {
      // Close HTTP server
      this.server.close(() => {
        console.log('HTTP server closed');
      });

      // Close WebSocket connections
      this.io.close(() => {
        console.log('WebSocket server closed');
      });

      // Close database connections
      await this.db.close();
      console.log('Database connections closed');

      console.log('Graceful shutdown completed');
      process.exit(0);
      
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }
}

// Start server nếu file này được chạy trực tiếp
if (require.main === module) {
  const server = new IntegrationServer();
  server.start();
}

module.exports = IntegrationServer;

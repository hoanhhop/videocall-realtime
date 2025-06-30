const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Import components
const integrationRoutes = require('./routes/integrationRoutes');
const IntegrationSocketHandlers = require('./websocket/integrationSocketHandlers');
const AuthMiddleware = require('./middleware/authMiddleware');

/**
 * Integration Server cho video call
 * Triển khai trên VM https://34.142.175.163
 * Tích hợp với database hiện có: hommy_database
 */
class IntegrationServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.auth = new AuthMiddleware();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupSocket();
  }

  setupMiddleware() {
    // CORS configuration
    this.app.use(cors({
      origin: [
        'http://localhost:3000',
        'http://localhost:3001', 
        'http://localhost:5173',
        'https://34.142.175.163',
        'https://yourdomain.com',
        process.env.FRONTEND_URL
      ].filter(Boolean),
      credentials: true
    }));

    // Rate limiting
    this.app.use(this.auth.rateLimit());

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Security headers
    this.app.use((req, res, next) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
      next();
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/', (req, res) => {
      res.json({
        message: 'Video Call Integration Server',
        status: 'running',
        version: '1.0.0',
        timestamp: new Date().toISOString()
      });
    });

    // API routes
    this.app.use('/api/integration', integrationRoutes);

    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        message: 'Endpoint không tồn tại'
      });
    });

    // Global error handler
    this.app.use(this.auth.errorHandler.bind(this.auth));
  }

  setupSocket() {
    // Socket.IO configuration
    this.io = socketIo(this.server, {
      cors: {
        origin: [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:5173', 
          'https://34.142.175.163',
          'https://yourdomain.com',
          process.env.FRONTEND_URL
        ].filter(Boolean),
        credentials: true
      },
      transports: ['websocket', 'polling']
    });

    // Setup socket handlers
    this.socketHandlers = new IntegrationSocketHandlers(this.io);

    console.log('✅ Socket.IO server configured');
  }

  start(port = process.env.PORT || 8080) {
    this.server.listen(port, '0.0.0.0', () => {
      console.log('🚀 Video Call Integration Server started');
      console.log(`📍 Server running on: http://0.0.0.0:${port}`);
      console.log(`🌐 Public URL: https://34.142.175.163:${port}`);
      console.log(`🗄️  Database: ${process.env.DB_NAME || 'hommy_database'}`);
      console.log(`🔌 Socket.IO ready for connections`);
      console.log('='.repeat(50));
    });
  }

  stop() {
    this.server.close(() => {
      console.log('🛑 Integration server stopped');
    });
  }
}

// Export class
module.exports = IntegrationServer;

// Start server if run directly
if (require.main === module) {
  const server = new IntegrationServer();
  server.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down gracefully...');
    server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down gracefully...');
    server.stop();
    process.exit(0);
  });
}

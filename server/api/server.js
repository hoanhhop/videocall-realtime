// server/index.js - API Server
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const { createLogger } = require('../utils/logger');
const redisClient = require('../services/redisClient');

// Khởi tạo logger
const logger = createLogger('api-server');

// Khởi tạo app Express
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Đăng ký các routes
const apiRoutes = require('./routes/apiRoutes');
const debugRoute = require('./routes/debugRoute'); // Thêm debug route

// Middleware cho debug routes
app.use('/debug', debugRoute);

// API routes
app.use('/api', (req, res, next) => {
  logger.info(`API request: ${req.method} ${req.url}`);
  if (req.method === 'POST' && req.path.includes('/stt')) {
    logger.info(`STT API được gọi với Content-Type: ${req.get('Content-Type')}`);
    if (req.file) {
      logger.info(`File đã tải lên: ${req.file.originalname}, size: ${req.file.size} bytes`);
    }
  }
  next();
}, apiRoutes);

// Route mặc định cho API
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Video Call Translation API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Middleware xử lý lỗi
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// Model status endpoint
app.get('/api/model-status', (req, res) => {
  res.json({
    phowhisper: {
      name: 'PhoWhisper',
      status: 'loaded',
      performance: 'WER: 4.67% on VIVOS dataset (70.3% better than Vosk)'
    },
    opusmt: {
      name: 'OPUS-MT',
      status: 'loaded',
      performance: 'High quality translation for English-Vietnamese and Vietnamese-English'
    }
  });
});

// Khởi động server
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  logger.info(`API Server running on port ${PORT}`);
  logger.info(`API available at: http://localhost:${PORT}/api`);
});

// Xử lý tắt server gracefully
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  redisClient.quit().then(() => {
    logger.info('Redis client disconnected');
    process.exit(0);
  });
});

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

module.exports = { app, redisClient };
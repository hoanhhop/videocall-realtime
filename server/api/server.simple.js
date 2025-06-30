// server/api/server.simple.js - Simple API Server for testing
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { createLogger } = require('../utils/logger');

// Khởi tạo logger
const logger = createLogger('api-server');

// Khởi tạo app Express
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Basic routes
app.get('/api', (req, res) => {
  res.json({ 
    message: 'Video Call Translation API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', service: 'api' });
});

// Model status endpoint
app.get('/api/model-status', (req, res) => {
  res.json({
    phowhisper: {
      name: 'PhoWhisper',
      status: 'loaded',
      performance: 'WER: 4.67% on VIVOS dataset'
    },
    opusmt: {
      name: 'OPUS-MT',
      status: 'loaded',
      performance: 'High quality translation'
    }
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`API Server running on port ${PORT}`);
  logger.info(`API available at: http://localhost:${PORT}/api`);
});

module.exports = { app };

// Debug version of server.js
console.log('=== API SERVER DEBUG VERSION START ===');

// 1. Environment check
console.log('Environment Variables:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('REDIS_URL:', process.env.REDIS_URL);
console.log('REDIS_HOST:', process.env.REDIS_HOST);
console.log('REDIS_PORT:', process.env.REDIS_PORT);

// 2. Load dotenv first
console.log('\nLoading dotenv...');
try {
  require('dotenv').config();
  console.log('✓ dotenv loaded');
} catch (err) {
  console.log('✗ dotenv error:', err.message);
}

// 3. Load basic modules
console.log('\nLoading basic modules...');
try {
  const express = require('express');
  console.log('✓ express loaded');
  
  const cors = require('cors');
  console.log('✓ cors loaded');
  
  const bodyParser = require('body-parser');
  console.log('✓ bodyParser loaded');
  
  const path = require('path');
  console.log('✓ path loaded');
} catch (err) {
  console.log('✗ Basic module error:', err.message);
  process.exit(1);
}

// 4. Load custom modules
console.log('\nLoading custom modules...');
let logger = null;
try {
  const { createLogger } = require('../utils/logger');
  logger = createLogger('api-server-debug');
  logger.info('Logger initialized successfully');
  console.log('✓ logger loaded and tested');
} catch (err) {
  console.log('✗ logger error:', err.message);
  console.log('Full logger error:', err);
  // Continue without logger
  logger = {
    info: console.log,
    error: console.error,
    warn: console.warn,
    debug: console.log
  };
}

let redisClient = null;
try {
  redisClient = require('../services/redisClient');
  console.log('✓ redis client loaded');
} catch (err) {
  console.log('✗ redis client error:', err.message);
  console.log('Full redis error:', err);
  // Continue without redis for now
}

// 5. Initialize Express app
console.log('\nInitializing Express app...');
try {
  const express = require('express');
  const cors = require('cors');
  const bodyParser = require('body-parser');
  
  const app = express();
  
  // Basic middleware
  app.use(cors());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  
  console.log('✓ Basic middleware configured');
  
  // Test route
  app.get('/api', (req, res) => {
    res.json({ 
      message: 'API Debug Server is running',
      version: '1.0.0-debug',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  });
  
  app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', debug: true });
  });
  
  console.log('✓ Basic routes configured');
  
  // Try to load other routes
  try {
    const apiRoutes = require('./routes/apiRoutes');
    app.use('/api', apiRoutes);
    console.log('✓ API routes loaded');
  } catch (err) {
    console.log('⚠ API routes error (continuing without):', err.message);
  }
  
  // Start server
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`✓ API Debug Server running on port ${PORT}`);
    console.log(`✓ Available at: http://0.0.0.0:${PORT}/api`);
    console.log('=== DEBUG SERVER STARTED SUCCESSFULLY ===');
    
    if (logger) {
      logger.info(`API Debug Server running on port ${PORT}`);
    }
  });
  
  // Error handling
  server.on('error', (err) => {
    console.log('✗ Server error:', err.message);
    if (logger) {
      logger.error('Server error:', err);
    }
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    if (redisClient && redisClient.quit) {
      redisClient.quit().then(() => {
        console.log('Redis client disconnected');
        server.close(() => {
          process.exit(0);
        });
      }).catch((err) => {
        console.log('Redis disconnect error:', err.message);
        server.close(() => {
          process.exit(0);
        });
      });
    } else {
      server.close(() => {
        process.exit(0);
      });
    }
  });
  
  process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    server.close(() => {
      process.exit(0);
    });
  });
  
} catch (err) {
  console.log('✗ Fatal error during app initialization:', err.message);
  console.log('Full error:', err);
  process.exit(1);
}

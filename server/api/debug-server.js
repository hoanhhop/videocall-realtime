// Debug script để kiểm tra API server
console.log('=== API SERVER DEBUG START ===');

// 1. Kiểm tra environment variables
console.log('1. Environment Variables:');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('REDIS_URL:', process.env.REDIS_URL);
console.log('REDIS_HOST:', process.env.REDIS_HOST);
console.log('REDIS_PORT:', process.env.REDIS_PORT);

// 2. Kiểm tra các module cơ bản
console.log('\n2. Testing basic modules:');
try {
  require('dotenv').config();
  console.log('✓ dotenv loaded');
} catch (err) {
  console.log('✗ dotenv error:', err.message);
}

try {
  const express = require('express');
  console.log('✓ express loaded');
} catch (err) {
  console.log('✗ express error:', err.message);
}

try {
  const cors = require('cors');
  console.log('✓ cors loaded');
} catch (err) {
  console.log('✗ cors error:', err.message);
}

// 3. Kiểm tra custom modules
console.log('\n3. Testing custom modules:');
try {
  const { createLogger } = require('../utils/logger');
  console.log('✓ logger module loaded');
  
  const logger = createLogger('debug');
  logger.info('Logger test message');
  console.log('✓ logger instance created and tested');
} catch (err) {
  console.log('✗ logger error:', err.message);
  console.log('Full error:', err);
}

try {
  const redisClient = require('../services/redisClient');
  console.log('✓ redis client module loaded');
} catch (err) {
  console.log('✗ redis client error:', err.message);
  console.log('Full error:', err);
}

// 4. Kiểm tra routes
console.log('\n4. Testing routes:');
try {
  const apiRoutes = require('./routes/apiRoutes');
  console.log('✓ apiRoutes loaded');
} catch (err) {
  console.log('✗ apiRoutes error:', err.message);
  console.log('Full error:', err);
}

try {
  const debugRoute = require('./routes/debugRoute');
  console.log('✓ debugRoute loaded');
} catch (err) {
  console.log('✗ debugRoute error:', err.message);
  console.log('Full error:', err);
}

// 5. Kiểm tra middleware
console.log('\n5. Testing middleware:');
try {
  const errorHandler = require('./middleware/errorHandler');
  console.log('✓ errorHandler loaded');
} catch (err) {
  console.log('✗ errorHandler error:', err.message);
  console.log('Full error:', err);
}

// 6. Test cơ bản Express app
console.log('\n6. Testing Express app creation:');
try {
  const express = require('express');
  const app = express();
  console.log('✓ Express app created');
  
  // Simple route test
  app.get('/test', (req, res) => {
    res.json({ message: 'test ok' });
  });
  
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    console.log(`✓ Server started on port ${PORT}`);
    console.log('=== DEBUG COMPLETE - Server is running ===');
  });
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down');
    server.close(() => {
      process.exit(0);
    });
  });
  
} catch (err) {
  console.log('✗ Express app error:', err.message);
  console.log('Full error:', err);
  process.exit(1);
}

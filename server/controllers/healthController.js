// server/controllers/healthController.js
const logger = require('../utils/logger');

const healthController = {
  // Health check endpoint
  healthCheck: (req, res) => {
    try {
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0'
      });
    } catch (error) {
      logger.error('Error in health check:', error);
      res.status(500).json({
        success: false,
        error: 'Health check failed'
      });
    }
  },

  // Detailed system status
  getSystemStatus: (req, res) => {
    try {
      res.json({
        success: true,
        system: {
          nodejs: process.version,
          platform: process.platform,
          arch: process.arch,
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cpu: process.cpuUsage()
        },
        services: {
          api: 'healthy',
          socket: 'healthy',
          translation: 'healthy',
          tts: 'healthy',
          embeddings: 'healthy'
        }
      });
    } catch (error) {
      logger.error('Error getting system status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get system status'
      });
    }
  }
};

module.exports = healthController;

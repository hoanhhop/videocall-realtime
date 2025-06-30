// server/controllers/apisController.js
const logger = require('../utils/logger');

const apisController = {
  // Get API status
  getApiStatus: (req, res) => {
    try {
      res.json({
        success: true,
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          translation: 'online',
          tts: 'online',
          speech: 'online',
          embeddings: 'online'
        }
      });
    } catch (error) {
      logger.error('Error getting API status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get API status'
      });
    }
  },

  // Get API configuration
  getApiConfig: (req, res) => {
    try {
      res.json({
        success: true,
        config: {
          maxFileSize: '10MB',
          supportedLanguages: ['vi', 'en', 'zh', 'ja', 'ko'],
          supportedFormats: ['mp3', 'wav', 'ogg']
        }
      });
    } catch (error) {
      logger.error('Error getting API config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get API config'
      });
    }
  }
};

module.exports = apisController;

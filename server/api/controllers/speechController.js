// server/controllers/speechController.js
const speechService = require('../services/speechService');

const speechController = {
  /**
   * HTTP handler for speech recognition
   */
  handleSpeechRecognition: async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No audio file provided' });
      }
      
      const language = req.query.language || 'vi';
      const result = await speechService.recognizeSpeech(req.file.buffer, language);
      
      res.json({ 
        text: result.text,
        language,
        confidence: result.confidence || 0.9,
        isTransformers: result.isTransformers || false,
        inferenceTime: result.inferenceTime,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Speech recognition handler error:', error);
      res.status(500).json({ error: 'Speech recognition failed', details: error.message });
    }
  },

  /**
   * Get speech recognition model info
   */
  getModelInfo: async (req, res) => {
    try {
      const modelInfo = await speechService.getModelInfo();
      res.json(modelInfo);
    } catch (error) {
      console.error('Error getting model info:', error);
      res.status(500).json({ error: 'Failed to get model info' });
    }
  }
};

module.exports = speechController;
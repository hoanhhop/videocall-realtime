// server/controllers/ttsController.js
const ttsService = require('../services/ttsService');

const ttsController = {
  /**
   * HTTP GET handler for text-to-speech
   */
  handleTextToSpeech: async (req, res) => {
    try {
      const text = req.query.text;
      const language = req.query.language || 'vi';
      
      if (!text) {
        return res.status(400).json({ error: 'No text provided' });
      }
      
      // Generate speech
      const audioBuffer = await ttsService.textToSpeech(text, language);
      
      // Send audio as response
      res.set('Content-Type', 'audio/wav');
      res.send(audioBuffer);
    } catch (error) {
      console.error('TTS handler error:', error);
      res.status(500).json({ error: 'Text-to-speech failed', details: error.message });
    }
  },
  
  /**
   * HTTP POST handler for text-to-speech
   */
  handleTextToSpeechPost: async (req, res) => {
    try {
      const { text, language } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'No text provided' });
      }
      
      // Generate speech
      const audioBuffer = await ttsService.textToSpeech(text, language || 'vi');
      
      // Send audio as response
      res.set('Content-Type', 'audio/wav');
      res.send(audioBuffer);
    } catch (error) {
      console.error('TTS handler error:', error);
      res.status(500).json({ error: 'Text-to-speech failed', details: error.message });
    }
  },
  
  /**
   * Check if TTS system is available
   */
  checkAvailability: async (req, res) => {
    try {
      const status = await ttsService.checkAvailability();
      res.json(status);
    } catch (error) {
      console.error('TTS availability check error:', error);
      res.status(500).json({ error: 'Failed to check TTS availability' });
    }
  }
};

module.exports = ttsController;
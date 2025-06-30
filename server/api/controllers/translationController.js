// server/controllers/translationController.js
const translationService = require('../services/translationService');

const translationController = {
  /**
   * HTTP handler for basic translation
   */
  handleTranslation: async (req, res) => {
    try {
      const { text, source, target } = req.body;
      
      if (!text || !source || !target) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      const translatedText = await translationService.translateText(text, source, target);
      
      res.json({ 
        original: text,
        translated: translatedText,
        source,
        target,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Translation handler error:', error);
      res.status(500).json({ error: 'Translation failed', details: error.message });
    }
  },
  
  /**
   * HTTP handler for context-aware translation
   */
  handleContextTranslation: async (req, res) => {
    try {
      const { text, source, target, context } = req.body;
      
      if (!text || !source || !target) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }
      
      const translatedText = await translationService.translateWithContext(text, source, target, context);
      
      res.json({ 
        original: text,
        translated: translatedText,
        source,
        target,
        context: context ? true : false,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Context translation handler error:', error);
      res.status(500).json({ error: 'Context translation failed', details: error.message });
    }
  },

  /**
   * Get translation model info
   */
  getModelInfo: (req, res) => {
    try {
      const modelInfo = translationService.getModelInfo();
      res.json(modelInfo);
    } catch (error) {
      console.error('Error getting model info:', error);
      res.status(500).json({ error: 'Failed to get model info' });
    }
  }
};

module.exports = translationController;
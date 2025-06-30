// server/controllers/contextController.js
const contextService = require('../services/contextService');

const contextController = {
  /**
   * HTTP handler for processing context from file
   */
  handleContextFile: async (req, res) => {
    try {
      if (!req.contextData) {
        return res.status(400).json({ error: 'No context data found' });
      }
      
      const { source, target } = req.body;
      
      // Process context
      const processedContext = contextService.processContext(
        req.contextData,
        source || 'vi',
        target || 'en'
      );
      
      res.json({
        context: processedContext,
        message: 'Context file processed successfully'
      });
    } catch (error) {
      console.error('Context file handler error:', error);
      res.status(500).json({ 
        error: 'Failed to process context file',
        details: error.message
      });
    }
  },
  
  /**
   * HTTP handler for processing context from direct text
   */
  handleContextText: async (req, res) => {
    try {
      const { text, source, target } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: 'No text provided' });
      }
      
      // Extract context from text
      const extractedContext = contextService.extractContextFromText(
        text,
        source || 'vi'
      );
      
      res.json({
        context: extractedContext,
        message: 'Context text processed successfully'
      });
    } catch (error) {
      console.error('Context text handler error:', error);
      res.status(500).json({ 
        error: 'Failed to process context text',
        details: error.message
      });
    }
  }
};

module.exports = contextController;
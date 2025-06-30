// server/controllers/uiController.js
const logger = require('../utils/logger');

// Store UI state in memory (in production, use Redis or database)
const uiState = new Map();

const uiController = {
  // Toggle subtitles for a room
  toggleSubtitles: (req, res) => {
    try {
      const { roomId, enabled } = req.body;
      
      if (!roomId) {
        return res.status(400).json({
          success: false,
          error: 'Room ID is required'
        });
      }

      // Get current state
      const currentState = uiState.get(roomId) || {
        subtitles: false,
        tts: false
      };

      // Update subtitles state
      currentState.subtitles = enabled !== undefined ? enabled : !currentState.subtitles;
      uiState.set(roomId, currentState);

      logger.info(`Subtitles ${currentState.subtitles ? 'enabled' : 'disabled'} for room: ${roomId}`);

      res.json({
        success: true,
        roomId,
        subtitles: currentState.subtitles
      });
    } catch (error) {
      logger.error('Error toggling subtitles:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to toggle subtitles'
      });
    }
  },

  // Toggle TTS for a room
  toggleTTS: (req, res) => {
    try {
      const { roomId, enabled } = req.body;
      
      if (!roomId) {
        return res.status(400).json({
          success: false,
          error: 'Room ID is required'
        });
      }

      // Get current state
      const currentState = uiState.get(roomId) || {
        subtitles: false,
        tts: false
      };

      // Update TTS state
      currentState.tts = enabled !== undefined ? enabled : !currentState.tts;
      uiState.set(roomId, currentState);

      logger.info(`TTS ${currentState.tts ? 'enabled' : 'disabled'} for room: ${roomId}`);

      res.json({
        success: true,
        roomId,
        tts: currentState.tts
      });
    } catch (error) {
      logger.error('Error toggling TTS:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to toggle TTS'
      });
    }
  },

  // Get UI state for a room
  getUIState: (req, res) => {
    try {
      const { roomId } = req.params;
      
      if (!roomId) {
        return res.status(400).json({
          success: false,
          error: 'Room ID is required'
        });
      }

      const currentState = uiState.get(roomId) || {
        subtitles: false,
        tts: false
      };

      res.json({
        success: true,
        roomId,
        state: currentState
      });
    } catch (error) {
      logger.error('Error getting UI state:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get UI state'
      });
    }
  }
};

module.exports = uiController;

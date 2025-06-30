// server/controllers/uiController.js
const redis = require('../services/redisClient');
const logger = require('../utils/logger').createLogger('uiController');

/**
 * Controller để xử lý các tùy chọn giao diện người dùng
 */
const uiController = {  /**
   * Bật/tắt hiển thị phụ đề
   */  toggleSubtitles: async (req, res) => {
    try {
      const { roomId, enabled } = req.body;
      
      if (!roomId) {
        return res.status(400).json({ error: 'Room ID is required' });
      }
      
      // Normalize Room ID to lowercase
      const normalizedRoomId = roomId.toLowerCase();
      
      // Lưu trạng thái phụ đề vào Redis
      const key = `room:${normalizedRoomId}:subtitles`;
      await redis.set(key, JSON.stringify({ enabled: !!enabled }));
      
      // Broadcast sự kiện này qua Socket.IO cho tất cả các namespace
      const io = req.app.get('io');
      if (io) {
        // Broadcast to main socket namespace
        io.to(normalizedRoomId).emit('subtitles_state_change', { enabled: !!enabled });
        
        // Also broadcast to stream namespace if it exists
        const streamNamespace = io.of('/stream');
        if (streamNamespace) {
          streamNamespace.to(normalizedRoomId).emit('subtitles_state_change', { enabled: !!enabled });
        }
      }
      
      logger.info(`Subtitles ${enabled ? 'enabled' : 'disabled'} for room ${roomId}`);
      
      res.json({ 
        success: true, 
        enabled: !!enabled,
        message: `Subtitles are now ${enabled ? 'visible' : 'hidden'}`
      });
    } catch (error) {
      logger.error('Error toggling subtitles:', error);
      res.status(500).json({ 
        error: 'Failed to toggle subtitles',
        details: error.message
      });
    }
  },
    /**
   * Bật/tắt dịch vụ Text-to-Speech
   */  toggleTTS: async (req, res) => {
    try {
      const { roomId, enabled } = req.body;
      
      if (!roomId) {
        return res.status(400).json({ error: 'Room ID is required' });
      }
      
      // Normalize Room ID to lowercase
      const normalizedRoomId = roomId.toLowerCase();
      
      // Lưu trạng thái TTS vào Redis
      const key = `room:${normalizedRoomId}:tts`;
      await redis.set(key, JSON.stringify({ enabled: !!enabled }));
      
      // Broadcast sự kiện này qua Socket.IO cho tất cả các namespace
      const io = req.app.get('io');
      if (io) {
        // Broadcast to main socket namespace
        io.to(normalizedRoomId).emit('tts_state_change', { enabled: !!enabled });
          // Also broadcast to stream namespace if it exists
        const streamNamespace = io.of('/stream');
        if (streamNamespace) {
          streamNamespace.to(normalizedRoomId).emit('tts_state_change', { enabled: !!enabled });
        }
      }
      
      logger.info(`TTS ${enabled ? 'enabled' : 'disabled'} for room ${roomId}`);
      
      res.json({ 
        success: true, 
        enabled: !!enabled,
        message: `TTS is now ${enabled ? 'enabled (original audio will be muted)' : 'disabled (original audio will be played)'}`
      });
    } catch (error) {
      logger.error('Error toggling TTS:', error);
      res.status(500).json({ 
        error: 'Failed to toggle TTS',
        details: error.message
      });
    }
  },
  
  /**
   * Lấy trạng thái hiện tại của UI
   */  getUIState: async (req, res) => {
    try {
      const { roomId } = req.params;
      
      if (!roomId) {
        return res.status(400).json({ error: 'Room ID is required' });
      }
      
      // Normalize Room ID to lowercase
      const normalizedRoomId = roomId.toLowerCase();
      
      // Lấy trạng thái từ Redis
      const subtitlesKey = `room:${normalizedRoomId}:subtitles`;
      const ttsKey = `room:${normalizedRoomId}:tts`;
      
      const [subtitlesData, ttsData] = await Promise.all([
        redis.get(subtitlesKey),
        redis.get(ttsKey)
      ]);
      
      const subtitles = subtitlesData ? JSON.parse(subtitlesData) : { enabled: true };
      const tts = ttsData ? JSON.parse(ttsData) : { enabled: false };
        res.json({
        roomId: normalizedRoomId,
        subtitles: subtitles.enabled,
        tts: tts.enabled
      });
    } catch (error) {
      logger.error('Error getting UI state:', error);
      res.status(500).json({
        error: 'Failed to get UI state',
        details: error.message
      });
    }
  }
};

module.exports = uiController;

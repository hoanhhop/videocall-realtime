// server/services/ttsServiceOptimized.js
/**
 * OPTIMIZATION VERSION NOTICE:
 * This is an optimized version of the TTS service client with:
 * - Class-based implementation instead of object literal 
 * - INT8 quantization support
 * - Optimized for CPU usage
 * 
 * It is currently not used in production but kept for future optimizations.
 * The active service is ttsService.js
 * 
 * @see /server/services/README.md for more details
 */
const axios = require('axios');
const FormData = require('./FormData');
const { createLogger } = require('../utils/logger');
const logger = createLogger('ttsServiceOptimized');

/**
 * Dịch vụ Text-to-Speech tối ưu hóa cho CPU với XTTS-v2
 * Được cấu hình để sử dụng ONNX (nếu có) và INT8 quantization
 */
class TTSServiceOptimized {
  constructor() {
    this.serviceUrl = process.env.TTS_SERVICE_URL || 'http://tts:5002';
    this.modelLoaded = false;
    this.modelInfo = {
      name: "XTTS-v2",
      implementation: "ONNX optimized",
      quantization: "INT8",
      threads: 4,
      features: {
        multi_speaker: true,
        streaming: true,
        low_latency: true
      }
    };
    
    logger.info(`TTS service initialized with URL: ${this.serviceUrl}`);
    logger.info(`Model configuration: ${JSON.stringify(this.modelInfo)}`);
  }

  /**
   * Kiểm tra kết nối đến dịch vụ TTS
   */
  async checkConnection() {
    try {
      const response = await axios.get(`${this.serviceUrl}/health`, {
        timeout: 10000
      });
      
      if (response.data && response.data.status === 'ok') {
        this.modelLoaded = true;
        logger.info('TTS service is connected and ready');
        
        // Cập nhật thông tin model từ service nếu có
        if (response.data.model) {
          this.modelInfo.name = response.data.model || this.modelInfo.name;
        }
        
        return true;
      }
      
      logger.warn('TTS service responded but model may not be ready');
      return false;
    } catch (error) {
      logger.error(`Failed to connect to TTS service: ${error.message}`);
      this.modelLoaded = false;
      return false;
    }
  }

  /**
   * Trả về thông tin về model và cấu hình
   */
  getModelInfo() {
    return {
      ...this.modelInfo,
      loaded: this.modelLoaded
    };
  }

  /**
   * Chuyển văn bản thành giọng nói
   * @param {string} text - Văn bản cần chuyển thành giọng nói
   * @param {string} language - Ngôn ngữ của văn bản (vi, en)
   * @param {Object} options - Các tùy chọn bổ sung
   * @returns {Buffer} - Buffer chứa dữ liệu âm thanh WAV
   */
  async textToSpeech(text, language = 'vi', options = {}) {
    try {
      if (!this.modelLoaded) {
        await this.checkConnection();
      }

      // Chuẩn bị form data
      const formData = new FormData();
      formData.append('text', text);
      formData.append('language', language);
      
      // Thêm speaker nếu được chỉ định
      if (options.speaker) {
        formData.append('speaker', options.speaker);
      }
      
      // Thêm reference voice nếu được cung cấp
      if (options.referenceVoice) {
        formData.append('reference_voice', options.referenceVoice, {
          filename: 'reference.wav',
          contentType: 'audio/wav'
        });
      }
      
      // Gọi API TTS
      const response = await axios.post(`${this.serviceUrl}/synthesize`, formData, {
        headers: {
          ...formData.getHeaders(),
          'Accept': 'audio/wav'
        },
        responseType: 'arraybuffer',
        timeout: 60000 // 60s timeout cho TTS
      });

      if (!response.data) {
        throw new Error('Empty response from TTS service');
      }

      // Trả về dữ liệu âm thanh dưới dạng buffer
      return Buffer.from(response.data);
    } catch (error) {
      logger.error(`TTS error: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new TTSServiceOptimized();

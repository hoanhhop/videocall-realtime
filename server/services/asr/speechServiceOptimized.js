// server/services/asr/speechServiceOptimized.js
const axios = require('axios');
const FormData = require('../FormData');
const { createLogger } = require('../utils/logger');
const logger = createLogger('speechServiceOptimized');

/**
 * Dịch vụ nhận dạng giọng nói tối ưu hóa cho CPU với PhoWhisper
 * Sử dụng faster-whisper với CTranslate2 và INT8 quantization
 */
class SpeechServiceOptimized {
  constructor() {
    this.serviceUrl = process.env.PHOWHISPER_ASR_URL || 'http://phowhisper:50051';
    this.modelLoaded = false;
    this.modelInfo = {
      name: "PhoWhisper-medium",
      implementation: "faster-whisper (CTranslate2)",
      quantization: "INT8",
      threads: 4,
      features: {
        vad_filter: true,
        beam_size: 1,
        compute_type: "int8",
        chunk_length: 0.4
      }
    };
    
    logger.info(`Speech service initialized with URL: ${this.serviceUrl}`);
    logger.info(`Model configuration: ${JSON.stringify(this.modelInfo)}`);
  }

  /**
   * Kiểm tra và tải mô hình
   */
  async loadModel() {
    try {
      const response = await axios.get(`${this.serviceUrl}/health`, {
        timeout: 10000
      });
      
      if (response.data && response.data.status === 'ok') {
        this.modelLoaded = true;
        logger.info('ASR model is loaded and ready');
        
        // Cập nhật thông tin model từ service nếu có
        if (response.data.model_info) {
          this.modelInfo = {
            ...this.modelInfo,
            ...response.data.model_info
          };
        }
        
        return true;
      }
      
      logger.warn('ASR service responded but model may not be ready');
      return false;
    } catch (error) {
      logger.error(`Failed to connect to ASR service: ${error.message}`);
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
   * Xử lý audio stream liên tục cho dịch thuật real-time
   * @param {Buffer} audioData - Dữ liệu âm thanh dưới dạng buffer
   * @param {string} language - Ngôn ngữ của âm thanh
   * @param {Object} previousState - Trạng thái từ lần xử lý trước (để duy trì liên tục)
   * @returns {Object} - Kết quả nhận dạng và trạng thái mới
   */
  async processStreamAudio(audioData, language = 'vi', previousState = null) {
    try {
      if (!this.modelLoaded) {
        await this.loadModel();
        if (!this.modelLoaded) {
          throw new Error('ASR model is not loaded');
        }
      }

      const formData = new FormData();
      formData.append('audio', audioData, {
        filename: 'stream.wav',
        contentType: 'audio/wav'
      });
      
      // Thêm tham số trạng thái trước đó nếu có
      if (previousState) {
        formData.append('state', JSON.stringify(previousState));
      }
      
      // Thêm ngôn ngữ
      formData.append('language', language);
      
      // Thiết lập để stream mode
      formData.append('stream', 'true');
      
      const response = await axios.post(`${this.serviceUrl}/asr/stream`, formData, {
        headers: {
          ...formData.getHeaders(),
          'Accept': 'application/json'
        },
        timeout: 30000 // 30s timeout cho xử lý âm thanh
      });

      if (!response.data) {
        throw new Error('Empty response from ASR service');
      }

      return {
        text: response.data.text || '',
        language: response.data.detected_language || language,
        state: response.data.state || null,
        isFinal: response.data.is_final || false
      };
    } catch (error) {
      logger.error(`Error in processStreamAudio: ${error.message}`);
      throw error;
    }
  }
}

module.exports = new SpeechServiceOptimized();

// server/services/socket/unixSocketManager.js
const net = require('net');
const fs = require('fs');
const path = require('path');
const { createLogger } = require('../utils/logger');
const logger = createLogger('unixSocketManager');
const { CircuitBreaker } = require('../utils/circuitBreaker');

/**
 * Quản lý các kết nối Unix socket cho các dịch vụ
 */
class UnixSocketManager {
  constructor() {
    this.socketBasePath = process.env.UNIX_SOCKET_PATH || '/tmp/video-call-translation';
    this.sockets = {
      asr: {
        path: `${this.socketBasePath}/asr.sock`,
        connected: false,
        client: null
      },
      translation: {
        path: `${this.socketBasePath}/translation.sock`,
        connected: false,
        client: null
      },
      tts: {
        path: `${this.socketBasePath}/tts.sock`,
        connected: false,
        client: null
      }
    };
    
    // Circuit breaker configurations
    this.cbOptions = {
      failureThreshold: 3,
      resetTimeout: 10000,
      halfOpenSuccessThreshold: 2,
      monitorInterval: 5000
    };
    
    // Create circuit breakers for each service method
    this.recognizeCircuit = new CircuitBreaker(
      this.recognizeSpeech.bind(this), 
      {
        ...this.cbOptions,
        fallbackFunction: this.fallbackRecognize.bind(this)
      }
    );
    
    this.translateCircuit = new CircuitBreaker(
      this.translateText.bind(this), 
      {
        ...this.cbOptions,
        fallbackFunction: this.fallbackTranslate.bind(this)
      }
    );
    
    this.synthesizeCircuit = new CircuitBreaker(
      this.synthesizeSpeech.bind(this), 
      {
        ...this.cbOptions,
        fallbackFunction: this.fallbackSynthesize.bind(this)
      }
    );
    
    // Đảm bảo thư mục socket tồn tại
    this.ensureSocketDirectory();
  }

  /**
   * Đảm bảo thư mục socket tồn tại
   */
  ensureSocketDirectory() {
    try {
      if (!fs.existsSync(this.socketBasePath)) {
        fs.mkdirSync(this.socketBasePath, { recursive: true });
        logger.info(`Created Unix socket directory: ${this.socketBasePath}`);
      }
    } catch (error) {
      logger.error(`Error creating socket directory: ${error.message}`);
    }
  }

  /**
   * Thiết lập kết nối đến một socket
   * @param {string} serviceName - Tên dịch vụ (asr, translation, tts)
   * @returns {Promise} - Kết quả kết nối
   */
  connect(serviceName) {
    return new Promise((resolve, reject) => {
      if (!this.sockets[serviceName]) {
        reject(new Error(`Unknown service: ${serviceName}`));
        return;
      }
      
      const socketInfo = this.sockets[serviceName];
      
      // Nếu đã kết nối, return
      if (socketInfo.connected && socketInfo.client) {
        resolve(socketInfo.client);
        return;
      }
      
      // Kiểm tra xem file socket có tồn tại không
      if (!fs.existsSync(socketInfo.path)) {
        reject(new Error(`Socket file does not exist: ${socketInfo.path}`));
        return;
      }
      
      // Tạo kết nối
      const client = net.createConnection(socketInfo.path);
      
      // Xử lý sự kiện kết nối
      client.on('connect', () => {
        logger.info(`Connected to ${serviceName} Unix socket: ${socketInfo.path}`);
        socketInfo.connected = true;
        socketInfo.client = client;
        resolve(client);
      });
      
      // Xử lý lỗi
      client.on('error', (error) => {
        logger.error(`Error connecting to ${serviceName} Unix socket: ${error.message}`);
        socketInfo.connected = false;
        socketInfo.client = null;
        reject(error);
      });
      
      // Xử lý ngắt kết nối
      client.on('close', () => {
        logger.info(`Disconnected from ${serviceName} Unix socket`);
        socketInfo.connected = false;
        socketInfo.client = null;
      });
      
      // Thiết lập timeout
      client.setTimeout(5000);
      client.on('timeout', () => {
        logger.warn(`Connection to ${serviceName} Unix socket timed out`);
        client.end();
        reject(new Error(`Connection timeout: ${serviceName}`));
      });
    });
  }

  /**
   * Gửi yêu cầu đến dịch vụ qua Unix socket
   * @param {string} serviceName - Tên dịch vụ
   * @param {Object} request - Đối tượng yêu cầu
   * @returns {Promise} - Kết quả từ dịch vụ
   */
  async sendRequest(serviceName, request) {
    try {
      let client;
      
      // Lấy hoặc tạo kết nối
      try {
        client = await this.connect(serviceName);
      } catch (error) {
        throw new Error(`Failed to connect to ${serviceName} service: ${error.message}`);
      }
      
      return new Promise((resolve, reject) => {
        // Tạo timeout cho response
        const timeout = setTimeout(() => {
          reject(new Error(`Request to ${serviceName} service timed out`));
        }, 30000);
        
        // Chuẩn bị dữ liệu response
        let responseData = '';
        
        // Xử lý dữ liệu
        client.on('data', (data) => {
          responseData += data.toString();
          
          // Kiểm tra xem dữ liệu đã hoàn chỉnh chưa (giả sử kết thúc bằng \n)
          if (responseData.endsWith('\n')) {
            clearTimeout(timeout);
            
            try {
              const response = JSON.parse(responseData);
              resolve(response);
            } catch (error) {
              reject(new Error(`Invalid response from ${serviceName} service: ${error.message}`));
            }
            
            // Remove listeners để tránh memory leak
            client.removeAllListeners('data');
            client.removeAllListeners('error');
          }
        });
        
        // Xử lý lỗi
        client.on('error', (error) => {
          clearTimeout(timeout);
          reject(new Error(`Error from ${serviceName} service: ${error.message}`));
          
          // Remove listeners
          client.removeAllListeners('data');
        });
        
        // Gửi yêu cầu
        const requestString = JSON.stringify(request) + '\n';
        client.write(requestString);
      });
    } catch (error) {
      logger.error(`Error sending request to ${serviceName} service: ${error.message}`);
      throw error;
    }
  }
  /**
   * Gửi dữ liệu nhận dạng giọng nói đến dịch vụ ASR
   * @param {Buffer} audioData - Dữ liệu âm thanh
   * @param {Object} options - Tùy chọn
   * @returns {Promise} - Kết quả từ dịch vụ ASR
   */
  async recognizeSpeech(audioData, options = {}) {
    try {
      const request = {
        action: 'recognize',
        audio_data: audioData.toString('base64'),
        options: {
          language: options.language || 'vi',
          state: options.state || null
        }
      };
      
      const response = await this.sendRequest('asr', request);
      return response;
    } catch (error) {
      logger.error(`Error in recognizeSpeech: ${error.message}`);
      
      // Fallback response khi lỗi
      return {
        text: '',
        language: options.language || 'vi',
        state: null,
        isFinal: false,
        error: true,
        message: error.message
      };
    }
  }
  
  /**
   * Wrapper for recognizeSpeech with circuit breaker
   * @param {Buffer} audioData - Audio data buffer
   * @param {Object} options - Recognition options
   * @returns {Promise} - ASR result with circuit breaker protection
   */
  async recognizeWithCircuitBreaker(audioData, options = {}) {
    return this.recognizeCircuit.call(audioData, options);
  }
  /**
   * Gửi văn bản để dịch đến dịch vụ Translation
   * @param {string} text - Văn bản cần dịch
   * @param {string} sourceLanguage - Ngôn ngữ nguồn
   * @param {string} targetLanguage - Ngôn ngữ đích
   * @param {Object} context - Context cho dịch thuật
   * @returns {Promise} - Kết quả dịch
   */
  async translateText(text, sourceLanguage, targetLanguage, context = null) {
    try {
      const request = {
        action: 'translate',
        text: text,
        source: sourceLanguage,
        target: targetLanguage,
        context: context
      };
      
      const response = await this.sendRequest('translation', request);
      return response;
    } catch (error) {
      logger.error(`Error in translateText: ${error.message}`);
      
      // Fallback response khi lỗi
      return {
        translatedText: `[Translation error] ${text}`,
        confidence: 0,
        error: true,
        message: error.message
      };
    }
  }
  
  /**
   * Wrapper for translateText with circuit breaker
   * @param {string} text - Text to translate 
   * @param {string} sourceLanguage - Source language
   * @param {string} targetLanguage - Target language
   * @param {Object} context - Translation context
   * @returns {Promise} - Translation result with circuit breaker protection
   */
  async translateWithCircuitBreaker(text, sourceLanguage, targetLanguage, context = null) {
    return this.translateCircuit.call(text, sourceLanguage, targetLanguage, context);
  }
  /**
   * Gửi văn bản đến dịch vụ TTS để chuyển đổi thành giọng nói
   * @param {string} text - Văn bản cần chuyển đổi
   * @param {string} language - Ngôn ngữ của văn bản
   * @param {Object} options - Tùy chọn (speaker, etc.)
   * @returns {Promise} - Dữ liệu âm thanh
   */
  async synthesizeSpeech(text, language, options = {}) {
    try {
      const request = {
        action: 'synthesize',
        text: text,
        language: language,
        options: {
          speaker: options.speaker || null,
          speed: options.speed || 1.0
        }
      };
      
      // Thêm reference voice nếu có
      if (options.referenceVoice) {
        request.options.referenceVoice = options.referenceVoice.toString('base64');
      }
      
      const response = await this.sendRequest('tts', request);
      
      // Chuyển đổi dữ liệu từ base64 về buffer
      if (response.audio_data) {
        response.audioBuffer = Buffer.from(response.audio_data, 'base64');
        delete response.audio_data; // Xóa bỏ dữ liệu base64 để giảm kích thước object
      }
      
      return response;
    } catch (error) {
      logger.error(`Error in synthesizeSpeech: ${error.message}`);
      
      // Fallback response khi lỗi - đọc file âm thanh trắng
      const fallbackFile = path.join(__dirname, '../../assets/fallback_audio.wav');
      let audioBuffer;
      
      try {
        if (fs.existsSync(fallbackFile)) {
          audioBuffer = fs.readFileSync(fallbackFile);
        } else {
          // Tạo buffer trống
          audioBuffer = Buffer.alloc(1024);
        }
      } catch (e) {
        audioBuffer = Buffer.alloc(1024);
      }
      
      return {
        audioBuffer: audioBuffer,
        sampleRate: 22050,
        error: true,
        message: error.message
      };
    }
  }
  
  /**
   * Wrapper for synthesizeSpeech with circuit breaker
   * @param {string} text - Text to synthesize
   * @param {string} language - Language of the text
   * @param {Object} options - Synthesis options
   * @returns {Promise} - TTS result with circuit breaker protection
   */
  async synthesizeWithCircuitBreaker(text, language, options = {}) {
    return this.synthesizeCircuit.call(text, language, options);
  }

  /**
   * Fallback method for speech recognition when the service is unavailable
   * @param {Buffer} audioData - Audio data buffer
   * @param {Object} options - Recognition options
   * @returns {Object} - Fallback recognition result
   */
  fallbackRecognize(audioData, options = {}) {
    logger.warn('Using fallback for ASR service (circuit open)');
    return {
      text: '[ASR service unavailable]',
      language: options.language || 'vi',
      state: null,
      isFinal: true,
      error: true,
      message: 'ASR service is currently unavailable'
    };
  }

  /**
   * Fallback method for text translation when the service is unavailable
   * @param {string} text - Text to translate
   * @param {string} sourceLanguage - Source language
   * @param {string} targetLanguage - Target language
   * @param {Object} context - Translation context
   * @returns {Object} - Fallback translation result
   */
  fallbackTranslate(text, sourceLanguage, targetLanguage, context = null) {
    logger.warn('Using fallback for Translation service (circuit open)');
    return {
      originalText: text,
      text: text, // Return original text as fallback
      sourceLang: sourceLanguage,
      targetLang: targetLanguage,
      confidence: 0,
      error: true,
      message: 'Translation service is currently unavailable'
    };
  }

  /**
   * Fallback method for speech synthesis when the service is unavailable
   * @param {string} text - Text to synthesize
   * @param {string} language - Language
   * @param {Object} options - Synthesis options
   * @returns {Object} - Fallback synthesis result
   */
  fallbackSynthesize(text, language, options = {}) {
    logger.warn('Using fallback for TTS service (circuit open)');
    
    // Try to get fallback audio file
    const fallbackFile = path.join(__dirname, '../../assets/fallback_audio.wav');
    let audioBuffer;
    
    try {
      if (fs.existsSync(fallbackFile)) {
        audioBuffer = fs.readFileSync(fallbackFile);
      } else {
        // Create empty buffer if fallback file doesn't exist
        audioBuffer = Buffer.alloc(1024);
      }
    } catch (e) {
      audioBuffer = Buffer.alloc(1024);
    }
    
    return {
      audioBuffer: audioBuffer,
      sampleRate: 22050,
      error: true,
      message: 'TTS service is currently unavailable'
    };
  }

  /**
   * Đóng tất cả các kết nối
   */
  closeAll() {
    for (const serviceName of Object.keys(this.sockets)) {
      const socketInfo = this.sockets[serviceName];
      if (socketInfo.connected && socketInfo.client) {
        socketInfo.client.end();
        socketInfo.connected = false;
        socketInfo.client = null;
        logger.info(`Closed connection to ${serviceName} Unix socket`);
      }
    }
  }
}

module.exports = new UnixSocketManager();

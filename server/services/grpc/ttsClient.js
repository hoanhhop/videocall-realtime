// server/services/grpc/ttsClient.js
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('../utils/logger');
const logger = createLogger('ttsGrpcClient');
const { CircuitBreaker } = require('../utils/circuitBreaker');
const { Readable } = require('stream');

// Đường dẫn đến file proto
const PROTO_PATH = path.join(__dirname, '../../protos/tts_service.proto');

/**
 * Client gRPC cho dịch vụ Text-to-Speech (XTTS-v2)
 */
class TTSGrpcClient {
  constructor() {
    this.client = null;
    this.serviceUrl = process.env.TTS_SERVICE_GRPC_URL || 'localhost:5002';
    this.timeoutMs = parseInt(process.env.GRPC_TIMEOUT || '60000');
    this.connected = false;
    this.cbOptions = {
      failureThreshold: 3,         // Số lần lỗi trước khi mở circuit
      resetTimeout: 10000,         // Thời gian (ms) trước khi thử lại sau khi mở circuit
      fallbackFunction: this.fallbackTTS.bind(this) // Hàm fallback khi circuit mở
    };
    
    // Circuit breaker cho các phương thức
    this.synthesizeCircuit = new CircuitBreaker(this.synthesize.bind(this), this.cbOptions);
    this.streamingSynthesizeCircuit = new CircuitBreaker(this.streamingSynthesize.bind(this), this.cbOptions);
    
    // Khởi tạo client
    this.init().catch(err => logger.error(`Error initializing TTS gRPC client: ${err.message}`));
  }

  /**
   * Khởi tạo kết nối gRPC
   */
  async init() {
    try {
      if (!fs.existsSync(PROTO_PATH)) {
        throw new Error(`Proto file not found at ${PROTO_PATH}`);
      }
      
      const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
      });
      
      const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
      
      // Tạo client với cấu hình timeout và retry
      this.client = new protoDescriptor.tts.TTSService(
        this.serviceUrl,
        grpc.credentials.createInsecure(),
        {
          'grpc.keepalive_time_ms': 10000,
          'grpc.keepalive_timeout_ms': 5000,
          'grpc.max_receive_message_length': 16 * 1024 * 1024, // 16MB for audio data
          'grpc.enable_retries': 1,
          'grpc.service_config': JSON.stringify({
            'methodConfig': [{
              'name': [{ 'service': 'tts.TTSService' }],
              'retryPolicy': {
                'maxAttempts': 2,
                'initialBackoff': '0.2s',
                'maxBackoff': '2s',
                'backoffMultiplier': 2.0,
                'retryableStatusCodes': ['UNAVAILABLE', 'DEADLINE_EXCEEDED']
              }
            }]
          })
        }
      );
      
      // Kiểm tra kết nối
      await this.checkConnection();
      
      logger.info(`TTS gRPC client initialized successfully (${this.serviceUrl})`);
    } catch (error) {
      this.connected = false;
      logger.error(`Failed to initialize TTS gRPC client: ${error.message}`);
      throw error;
    }
  }

  /**
   * Kiểm tra kết nối gRPC
   */
  async checkConnection() {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        this.connected = false;
        reject(new Error('Client not initialized'));
        return;
      }
      
      // Gọi health check
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + 5);
      
      this.client.healthCheck({}, { deadline }, (err, response) => {
        if (err) {
          this.connected = false;
          logger.warn(`TTS gRPC health check failed: ${err.message}`);
          reject(err);
          return;
        }
        
        if (response.status !== 'SERVING') {
          this.connected = false;
          logger.warn(`TTS gRPC service not ready: ${response.status}`);
          reject(new Error(`Service not ready: ${response.status}`));
          return;
        }
        
        this.connected = true;
        logger.info('TTS gRPC service is healthy');
        resolve(true);
      });
    });
  }

  /**
   * Chuyển văn bản thành giọng nói
   * @param {string} text - Văn bản cần chuyển thành giọng nói
   * @param {string} language - Ngôn ngữ của văn bản
   * @param {Object} options - Tùy chọn khác (speaker, speed, etc.)
   * @returns {Promise<Buffer>} - Buffer chứa dữ liệu âm thanh
   */
  async synthesize(text, language = 'vi', options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('TTS gRPC client not initialized'));
        return;
      }
      
      const request = {
        text: text,
        language: language,
        speaker_id: options.speaker || '',
        speed: options.speed || 1.0
      };
      
      // Thêm reference voice nếu có
      if (options.referenceVoice && Buffer.isBuffer(options.referenceVoice)) {
        request.reference_voice = options.referenceVoice;
      }
      
      // Thiết lập deadline
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + this.timeoutMs / 1000);
      
      this.client.synthesize(request, { deadline }, (err, response) => {
        if (err) {
          logger.error(`TTS synthesize error: ${err.message}`);
          reject(err);
          return;
        }
        
        resolve({
          audioData: response.audio_data,
          sampleRate: response.sample_rate,
          format: response.format || 'wav'
        });
      });
    });
  }

  /**
   * Streaming synthesis cho văn bản dài
   * @param {string} text - Văn bản cần chuyển thành giọng nói
   * @param {string} language - Ngôn ngữ của văn bản
   * @param {Object} options - Tùy chọn khác (speaker, speed, etc.)
   * @returns {Promise<Readable>} - Stream dữ liệu âm thanh
   */
  async streamingSynthesize(text, language = 'vi', options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('TTS gRPC client not initialized'));
        return;
      }
      
      try {
        // Tạo stream đầu ra
        const audioStream = new Readable({
          read() {} // Implementation required but we push data when received
        });
        
        // Tạo request stream
        const call = this.client.streamingSynthesize();
        
        // Xử lý dữ liệu từ server
        call.on('data', (response) => {
          // Push audio chunk to output stream
          if (response.audio_chunk && response.audio_chunk.length > 0) {
            audioStream.push(response.audio_chunk);
          }
          
          // Nếu là chunk cuối cùng
          if (response.is_last) {
            audioStream.push(null); // End of stream
          }
        });
        
        call.on('end', () => {
          // Đảm bảo stream đã kết thúc
          if (audioStream.readable) {
            audioStream.push(null);
          }
        });
        
        call.on('error', (error) => {
          logger.error(`TTS streaming error: ${error.message}`);
          // End the stream with error
          audioStream.emit('error', error);
          reject(error);
        });
        
        // Gửi request ban đầu
        const request = {
          text: text,
          language: language,
          speaker_id: options.speaker || '',
          speed: options.speed || 1.0,
          chunk_size: options.chunkSize || 120
        };
        
        // Thêm reference voice nếu có
        if (options.referenceVoice && Buffer.isBuffer(options.referenceVoice)) {
          request.reference_voice = options.referenceVoice;
        }
        
        call.write(request);
        call.end();
        
        resolve(audioStream);
      } catch (error) {
        logger.error(`TTS streaming setup error: ${error.message}`);
        reject(error);
      }
    });
  }

  /**
   * Liệt kê các speaker có sẵn
   * @returns {Promise<Array>} - Danh sách các speaker
   */
  async listSpeakers() {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('TTS gRPC client not initialized'));
        return;
      }
      
      // Thiết lập deadline
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + 5);
      
      this.client.listSpeakers({}, { deadline }, (err, response) => {
        if (err) {
          logger.error(`TTS listSpeakers error: ${err.message}`);
          reject(err);
          return;
        }
        
        resolve(response.speakers || []);
      });
    });
  }

  /**
   * Fallback method khi TTS service gặp sự cố
   */
  async fallbackTTS(text, language, options) {
    logger.warn(`Using fallback TTS for language: ${language}`);
    
    // Đọc file âm thanh fallback từ hệ thống nếu có
    const fallbackFile = path.join(__dirname, '../../assets/fallback_audio.wav');
    let fallbackAudio;
    
    try {
      if (fs.existsSync(fallbackFile)) {
        fallbackAudio = fs.readFileSync(fallbackFile);
      } else {
        // Tạo một buffer âm thanh trống
        fallbackAudio = Buffer.alloc(1024);
      }
      
      return {
        audioData: fallbackAudio,
        sampleRate: 22050,
        format: 'wav',
        error: "TTS service unavailable, using fallback"
      };
    } catch (error) {
      logger.error(`Fallback TTS error: ${error.message}`);
      throw new Error('TTS service is unavailable and fallback failed');
    }
  }

  /**
   * Đóng kết nối gRPC
   */
  close() {
    if (this.client) {
      grpc.closeClient(this.client);
      this.client = null;
      this.connected = false;
      logger.info('TTS gRPC client closed');
    }
  }
}

module.exports = new TTSGrpcClient();

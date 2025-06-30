// server/services/grpc/asrClient.js
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('../utils/logger');
const logger = createLogger('asrGrpcClient');
const { CircuitBreaker } = require('../utils/circuitBreaker');

// Đường dẫn đến file proto
const PROTO_PATH = path.join(__dirname, '../../protos/asr_service.proto');

/**
 * Client gRPC cho dịch vụ ASR (PhoWhisper)
 */
class ASRGrpcClient {
  constructor() {
    this.client = null;
    this.serviceUrl = process.env.PHOWHISPER_ASR_GRPC_URL || 'localhost:50051';
    this.timeoutMs = parseInt(process.env.GRPC_TIMEOUT || '30000');
    this.connected = false;
    this.cbOptions = {
      failureThreshold: 3,         // Số lần lỗi trước khi mở circuit
      resetTimeout: 10000,         // Thời gian (ms) trước khi thử lại sau khi mở circuit
      fallbackFunction: this.fallbackASR.bind(this) // Hàm fallback khi circuit mở
    };
    
    // Circuit breaker cho các phương thức
    this.recognizeCircuit = new CircuitBreaker(this.recognize.bind(this), this.cbOptions);
    this.streamingRecognizeCircuit = new CircuitBreaker(this.streamingRecognize.bind(this), this.cbOptions);
    
    // Khởi tạo client
    this.init().catch(err => logger.error(`Error initializing ASR gRPC client: ${err.message}`));
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
      
      // Tạo client với cấu hình timeout
      this.client = new protoDescriptor.asr.ASRService(
        this.serviceUrl,
        grpc.credentials.createInsecure(),
        {
          'grpc.keepalive_time_ms': 10000,
          'grpc.keepalive_timeout_ms': 5000,
          'grpc.max_receive_message_length': 10 * 1024 * 1024, // 10MB
          'grpc.enable_retries': 1,
          'grpc.service_config': JSON.stringify({
            'methodConfig': [{
              'name': [{ 'service': 'asr.ASRService' }],
              'retryPolicy': {
                'maxAttempts': 3,
                'initialBackoff': '0.1s',
                'maxBackoff': '1s',
                'backoffMultiplier': 2.0,
                'retryableStatusCodes': ['UNAVAILABLE', 'DEADLINE_EXCEEDED']
              }
            }]
          })
        }
      );
      
      // Kiểm tra kết nối
      await this.checkConnection();
      
      logger.info(`ASR gRPC client initialized successfully (${this.serviceUrl})`);
    } catch (error) {
      this.connected = false;
      logger.error(`Failed to initialize ASR gRPC client: ${error.message}`);
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
          logger.warn(`ASR gRPC health check failed: ${err.message}`);
          reject(err);
          return;
        }
        
        if (response.status !== 'SERVING') {
          this.connected = false;
          logger.warn(`ASR gRPC service not ready: ${response.status}`);
          reject(new Error(`Service not ready: ${response.status}`));
          return;
        }
        
        this.connected = true;
        logger.info('ASR gRPC service is healthy');
        resolve(true);
      });
    });
  }

  /**
   * Nhận dạng giọng nói (gọi không đồng bộ)
   * @param {Buffer} audioData - Dữ liệu âm thanh dạng buffer
   * @param {Object} options - Các tùy chọn cho ASR
   * @returns {Promise} - Kết quả nhận dạng
   */
  async recognize(audioData, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('ASR gRPC client not initialized'));
        return;
      }
      
      const request = {
        audio: audioData,
        config: {
          language: options.language || 'vi',
          model: options.model || 'medium',
          enable_vad: options.enableVad ?? true,
          compute_type: options.computeType || 'int8',
          beam_size: options.beamSize || 1
        }
      };
      
      // Thiết lập deadline
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + this.timeoutMs / 1000);
      
      this.client.recognize(request, { deadline }, (err, response) => {
        if (err) {
          logger.error(`ASR recognize error: ${err.message}`);
          reject(err);
          return;
        }
        
        resolve({
          text: response.text,
          language: response.detected_language,
          confidence: response.confidence
        });
      });
    });
  }

  /**
   * Streaming nhận dạng giọng nói
   * @param {Readable} audioStream - Stream dữ liệu âm thanh
   * @param {Object} options - Các tùy chọn cho ASR
   * @returns {Promise} - Kết quả nhận dạng
   */
  async streamingRecognize(audioStream, options = {}) {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('ASR gRPC client not initialized'));
        return;
      }
      
      try {
        // Tạo stream hai chiều
        const call = this.client.streamingRecognize();
        
        // Xử lý kết quả nhận được
        const results = [];
        
        call.on('data', (response) => {
          results.push({
            text: response.text,
            isFinal: response.is_final,
            language: response.detected_language,
            confidence: response.confidence
          });
        });
        
        call.on('end', () => {
          resolve(results);
        });
        
        call.on('error', (error) => {
          logger.error(`ASR streaming error: ${error.message}`);
          reject(error);
        });
        
        // Gửi cấu hình
        call.write({
          config: {
            language: options.language || 'vi',
            model: options.model || 'medium',
            enable_vad: options.enableVad ?? true,
            compute_type: options.computeType || 'int8',
            beam_size: options.beamSize || 1
          }
        });
        
        // Gửi dữ liệu âm thanh
        audioStream.on('data', (chunk) => {
          call.write({ audio_chunk: chunk });
        });
        
        audioStream.on('end', () => {
          call.end();
        });
        
        audioStream.on('error', (err) => {
          logger.error(`Audio stream error: ${err.message}`);
          call.end();
          reject(err);
        });
      } catch (error) {
        logger.error(`ASR streaming setup error: ${error.message}`);
        reject(error);
      }
    });
  }

  /**
   * Fallback method khi ASR service gặp sự cố
   */
  async fallbackASR(audioData, options = {}) {
    logger.warn('Using fallback ASR (returning empty result)');
    return {
      text: "",
      language: options.language || "vi",
      confidence: 0,
      error: "ASR service unavailable, using fallback"
    };
  }

  /**
   * Đóng kết nối gRPC
   */
  close() {
    if (this.client) {
      grpc.closeClient(this.client);
      this.client = null;
      this.connected = false;
      logger.info('ASR gRPC client closed');
    }
  }
}

module.exports = new ASRGrpcClient();

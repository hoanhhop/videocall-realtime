// server/services/grpc/mtClient.js
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const fs = require('fs');
const { createLogger } = require('../utils/logger');
const logger = createLogger('mtGrpcClient');
const { CircuitBreaker } = require('../utils/circuitBreaker');

// Đường dẫn đến file proto
const PROTO_PATH = path.join(__dirname, '../../protos/translation_service.proto');

/**
 * Client gRPC cho dịch vụ Machine Translation (OPUS-MT)
 */
class MTGrpcClient {
  constructor() {
    this.client = null;
    this.serviceUrl = process.env.TRANSLATION_SERVICE_GRPC_URL || 'localhost:50052';
    this.timeoutMs = parseInt(process.env.GRPC_TIMEOUT || '20000');
    this.connected = false;
    this.cbOptions = {
      failureThreshold: 3,         // Số lần lỗi trước khi mở circuit
      resetTimeout: 10000,         // Thời gian (ms) trước khi thử lại sau khi mở circuit
      fallbackFunction: this.fallbackTranslate.bind(this) // Hàm fallback khi circuit mở
    };
    
    // Circuit breaker cho các phương thức
    this.translateCircuit = new CircuitBreaker(this.translate.bind(this), this.cbOptions);
    this.translateWithContextCircuit = new CircuitBreaker(this.translateWithContext.bind(this), this.cbOptions);
    
    // Khởi tạo client
    this.init().catch(err => logger.error(`Error initializing MT gRPC client: ${err.message}`));
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
      this.client = new protoDescriptor.translation.TranslationService(
        this.serviceUrl,
        grpc.credentials.createInsecure(),
        {
          'grpc.keepalive_time_ms': 10000,
          'grpc.keepalive_timeout_ms': 5000,
          'grpc.max_receive_message_length': 4 * 1024 * 1024, // 4MB
          'grpc.enable_retries': 1,
          'grpc.service_config': JSON.stringify({
            'methodConfig': [{
              'name': [{ 'service': 'translation.TranslationService' }],
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
      
      logger.info(`MT gRPC client initialized successfully (${this.serviceUrl})`);
    } catch (error) {
      this.connected = false;
      logger.error(`Failed to initialize MT gRPC client: ${error.message}`);
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
          logger.warn(`MT gRPC health check failed: ${err.message}`);
          reject(err);
          return;
        }
        
        if (response.status !== 'SERVING') {
          this.connected = false;
          logger.warn(`MT gRPC service not ready: ${response.status}`);
          reject(new Error(`Service not ready: ${response.status}`));
          return;
        }
        
        this.connected = true;
        logger.info('MT gRPC service is healthy');
        resolve(true);
      });
    });
  }

  /**
   * Dịch văn bản (không có context)
   * @param {string} text - Văn bản cần dịch
   * @param {string} sourceLanguage - Ngôn ngữ nguồn
   * @param {string} targetLanguage - Ngôn ngữ đích
   * @returns {Promise} - Kết quả dịch
   */
  async translate(text, sourceLanguage, targetLanguage) {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('MT gRPC client not initialized'));
        return;
      }
      
      const request = {
        text: text,
        source_language: sourceLanguage,
        target_language: targetLanguage
      };
      
      // Thiết lập deadline
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + this.timeoutMs / 1000);
      
      this.client.translate(request, { deadline }, (err, response) => {
        if (err) {
          logger.error(`MT translate error: ${err.message}`);
          reject(err);
          return;
        }
        
        resolve({
          translatedText: response.translated_text,
          confidence: response.confidence
        });
      });
    });
  }

  /**
   * Dịch văn bản với context
   * @param {string} text - Văn bản cần dịch
   * @param {string} sourceLanguage - Ngôn ngữ nguồn
   * @param {string} targetLanguage - Ngôn ngữ đích
   * @param {Object} context - Context để cải thiện chất lượng dịch
   * @returns {Promise} - Kết quả dịch
   */
  async translateWithContext(text, sourceLanguage, targetLanguage, context) {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error('MT gRPC client not initialized'));
        return;
      }
      
      const request = {
        text: text,
        source_language: sourceLanguage,
        target_language: targetLanguage,
        context: JSON.stringify(context) // Chuyển đổi context sang JSON string
      };
      
      // Thiết lập deadline
      const deadline = new Date();
      deadline.setSeconds(deadline.getSeconds() + this.timeoutMs / 1000);
      
      this.client.translateWithContext(request, { deadline }, (err, response) => {
        if (err) {
          logger.error(`MT translateWithContext error: ${err.message}`);
          reject(err);
          return;
        }
        
        resolve({
          translatedText: response.translated_text,
          confidence: response.confidence
        });
      });
    });
  }

  /**
   * Fallback method khi MT service gặp sự cố
   */
  async fallbackTranslate(text, sourceLanguage, targetLanguage) {
    logger.warn(`Using fallback MT (simple translation) from ${sourceLanguage} to ${targetLanguage}`);
    
    // Trả về văn bản gốc với lưu ý
    return {
      translatedText: `[Translation service unavailable] ${text}`,
      confidence: 0,
      error: "MT service unavailable, using fallback"
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
      logger.info('MT gRPC client closed');
    }
  }
}

module.exports = new MTGrpcClient();

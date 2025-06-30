// server/services/translation/translationService.js 
// WARNING: This file is a duplicate of /services/translationService.js
// It's currently used by socket components but should be consolidated with the main file
// See /services/README.md for details
const { createLogger } = require('../../utils/logger');
const { translateTextViaHttp, checkTranslationServiceHealth } = require('../../utils/translationNodeClient');

const logger = createLogger('translation-service-duplicate');

// Trạng thái kết nối đến Translation HTTP service
let isTranslationServiceConnected = false;
let lastTranslationConnectionAttempt = 0;
const TRANSLATION_CONNECTION_RETRY_INTERVAL = 10000; // Thử lại sau mỗi 10 giây

// Model names (ví dụ, có thể được cấu hình ở nơi khác hoặc client tự quyết định)
const DEFAULT_VI_EN_MODEL = 'Helsinki-NLP/opus-mt-vi-en';
const DEFAULT_EN_VI_MODEL = 'Helsinki-NLP/opus-mt-en-vi';

/**
 * Kiểm tra kết nối đến Translation HTTP Service
 */
const loadModel = async () => {
  logger.info("Kiểm tra kết nối đến Translation HTTP service...");
  const now = Date.now();
  if (isTranslationServiceConnected || (now - lastTranslationConnectionAttempt < TRANSLATION_CONNECTION_RETRY_INTERVAL)) {
    return isTranslationServiceConnected;
  }

  lastTranslationConnectionAttempt = now;
  isTranslationServiceConnected = await checkTranslationServiceHealth();
  if (isTranslationServiceConnected) {
    logger.info('Kết nối Translation HTTP service thành công.');
  } else {
    logger.warn('Không thể kết nối đến Translation HTTP service.');
  }
  return isTranslationServiceConnected;
};

// Kiểm tra kết nối ban đầu
loadModel();

/**
 * Post-processing to improve translation quality
 * - Fix repeated phrases
 * - Ensure proper punctuation
 * - Apply contextual corrections
 */
const postProcessTranslation = (text, sourceLang, targetLang, context = null) => {
  if (!text) return text;
  
  let processed = text;
  
  // Fix repeated phrases (common issue in NMT systems)
  const maxRepeatLength = 4; // Maximum words to check for repetition
  const words = processed.split(' ');
  
  if (words.length > maxRepeatLength * 2) {
    for (let i = 0; i < words.length - maxRepeatLength; i++) {
      let isRepeated = true;
      for (let j = 0; j < maxRepeatLength; j++) {
        if (words[i + j] !== words[i + maxRepeatLength + j]) {
          isRepeated = false;
          break;
        }
      }
      
      if (isRepeated) {
        // Remove the repeated phrase
        words.splice(i, maxRepeatLength);
        i--; // Check again at the same position
      }
    }
    
    processed = words.join(' ');
  }
  
  // Apply context-specific corrections if available
  if (context && context.glossary) {
    // Apply glossary terms to ensure consistency
    for (const entry of context.glossary) {
      const term = targetLang === 'en' ? entry.source : entry.target;
      const translation = targetLang === 'en' ? entry.target : entry.source;
      
      // Only replace whole words, not partial matches
      const regex = new RegExp(`\\b${term}\\b`, 'gi');
      processed = processed.replace(regex, translation);
    }
  }
  
  // Ensure proper sentence ending punctuation
  if (!processed.match(/[.!?]$/)) {
    const lastChar = processed.slice(-1);
    if (lastChar !== ',' && lastChar !== ';' && lastChar !== ':') {
      processed += '.';
    }
  }
  
  return processed;
};

const translationService = {
  /**
   * Basic translation without context
   * @param {string} text - Text to translate
   * @param {string} source - Source language code (vi, en)
   * @param {string} target - Target language code (vi, en)
   * @returns {Promise<string>} Translated text
   */
  translateText: async (text, sourceLang, targetLang, context = null) => {
    try {
      if (!isTranslationServiceConnected) {
        logger.warn('Translation service không sẵn sàng, thử kết nối lại.');
        await loadModel(); // Thử kết nối lại
        if (!isTranslationServiceConnected) {
          logger.error('Không thể dịch do Translation service không khả dụng.');
          // Trả về text gốc hoặc lỗi thay vì giả lập
          return { text: text, error: 'Translation service unavailable', model: 'N/A' }; 
        }
      }

      let modelName;
      if (sourceLang === 'vi' && targetLang === 'en') {
        modelName = DEFAULT_VI_EN_MODEL;
      } else if (sourceLang === 'en' && targetLang === 'vi') {
        modelName = DEFAULT_EN_VI_MODEL;
      } else {
        logger.warn(`Không có model mặc định cho cặp ngôn ngữ ${sourceLang} -> ${targetLang}. Client cần chỉ định model_name.`);
        // Trong trường hợp này, client nên gửi `model_name` qua socketController
        // Hoặc bạn có thể ném lỗi ở đây
        return { text: text, error: `No default model for ${sourceLang}->${targetLang}`, model: 'N/A' };
      }
      
      // Nếu client gửi model_name cụ thể (ví dụ, từ socketController), nó sẽ được ưu tiên
      // Hiện tại, logic này nằm trong translationService.js, cần điều chỉnh nếu socketController truyền model_name

      const translationResult = await translateTextViaHttp(text, modelName);

      if (!translationResult) {
        logger.error('Không nhận được kết quả từ Translation HTTP service.');
        return { text: text, error: 'No response from translation service', model: modelName };
      }
      
      // Kiểm tra định dạng phản hồi từ dịch vụ Python
      if (typeof translationResult.translated === 'string') {
        // Định dạng mới từ run_translation.py
        let processedText = postProcessTranslation(translationResult.translated, sourceLang, targetLang, context);
        
        logger.info(`Dịch từ ${sourceLang} sang ${targetLang} bằng model ${modelName}: "${text.substring(0,30)}..." -> "${processedText.substring(0,30)}..."`);
        
        return {
          text: processedText,
          originalText: text,
          model: modelName,
          sourceLang: sourceLang,
          targetLang: targetLang,
          processingTimeMs: translationResult.processing_time || 0
        };
      } else if (typeof translationResult.translated_text === 'string') {
        // Định dạng cũ
        let processedText = postProcessTranslation(translationResult.translated_text, sourceLang, targetLang, context);
        
        logger.info(`Dịch từ ${sourceLang} sang ${targetLang} bằng model ${modelName}: "${text.substring(0,30)}..." -> "${processedText.substring(0,30)}..."`);
        
        return {
          text: processedText,
          originalText: text,
          model: translationResult.model_name || modelName,
          sourceLang: sourceLang,
          targetLang: targetLang,
          processingTimeMs: translationResult.processing_time_ms
        };
      } else {
        logger.error('Định dạng phản hồi không hợp lệ từ Translation HTTP service:', translationResult);
        return { text: text, error: 'Invalid response format from translation service', model: modelName };
      }

    } catch (error) {
      logger.error('Lỗi dịch thuật trong translationService:', error);
      return { text: text, error: `Translation failed: ${error.message}`, model: 'Error' };
    }
  },
  
  /**
   * Context-aware translation
   * @param {string} text - Text to translate
   * @param {string} source - Source language code (vi, en)
   * @param {string} target - Target language code (vi, en)
   * @param {Object} context - Context object
   * @param {string} [enhancedPrompt] - Pre-formatted prompt with context
   * @returns {Promise<string>} Translated text
   */
  translateWithContext: async (text, source, target, context, enhancedPrompt = null) => {
    logger.warn('translateWithContext hiện đang sử dụng logic giả lập. Cần nâng cấp để sử dụng service Python với context.');
    // Tạm thời gọi lại hàm translateText cơ bản và bỏ qua context nâng cao từ Python service
    // Hoặc bạn có thể gửi context (ví dụ: glossary) vào payload của translateTextViaHttp nếu service Python hỗ trợ
    const basicTranslation = await translationService.translateText(text, source, target, context);
    // Logic giả lập của bạn có thể được áp dụng thêm ở đây nếu muốn, 
    // nhưng tốt nhất là service Python nên xử lý context.
    return basicTranslation; 
  },
  
  /**
   * Get model information
   * @returns {Object} Model information
   */
  getModelInfo: () => {
    return {
      name: 'OPUS-MT via HTTP Service',
      status: isTranslationServiceConnected ? 'connected' : 'disconnected',
      service_url: process.env.TRANSLATION_SERVICE_URL || 'http://localhost:50052',
      models_example: [DEFAULT_VI_EN_MODEL, DEFAULT_EN_VI_MODEL],
      features: [
        'Real-time translation via HTTP',
        'Post-processing for improved fluency'
      ]
    };
  },

  // Thêm hàm kiểm tra kết nối để socket-server có thể gọi nếu cần
  checkConnection: loadModel 
};

module.exports = translationService;
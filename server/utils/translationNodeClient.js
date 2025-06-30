const axios = require('axios');
const { createLogger } = require('./logger'); // Giả sử bạn có logger chung

const logger = createLogger('translation-node-client');

const TRANSLATION_SERVICE_URL = process.env.TRANSLATION_SERVICE_URL || 'http://127.0.0.1:50052'; // Sử dụng 127.0.0.1

/**
 * Gửi yêu cầu dịch văn bản đến Translation Service Python.
 * @param {string} textToTranslate Văn bản cần dịch.
 * @param {string} modelName Tên model trên Hugging Face (ví dụ: 'Helsinki-NLP/opus-mt-vi-en').
 * @returns {Promise<Object|null>} Kết quả dịch hoặc null nếu có lỗi.
 */
const translateTextViaHttp = async (textToTranslate, modelName) => {
    if (!textToTranslate || !modelName) {
        logger.warn('Văn bản hoặc tên model không được cung cấp.');
        return null;
    }

    // Xác định ngôn ngữ nguồn và đích từ tên model
    const modelParts = modelName.split('/')[1]?.split('-');
    if (!modelParts || modelParts.length < 3) {
        logger.warn(`Không thể trích xuất thông tin ngôn ngữ từ tên model: ${modelName}`);
        return null;
    }

    // Lấy source & target từ tên model (ví dụ: opus-mt-vi-en)
    const source = modelParts[2];
    const target = modelParts[3];
    
    if (!source || !target) {
        logger.warn(`Không thể xác định source/target từ model: ${modelName}`);
        return null;
    }

    try {
        // Chuẩn bị văn bản - giới hạn độ dài để tránh timeout
        const trimmedText = textToTranslate.length > 200 
            ? textToTranslate.substring(0, 200) + '...' 
            : textToTranslate;
            
        logger.info(`Đang gửi yêu cầu dịch cho "${trimmedText.substring(0, 40)}..." bằng model ${modelName} đến ${TRANSLATION_SERVICE_URL}/translate`);
        
        // Thêm timeout dài hơn (30 giây) cho các văn bản dài
        const response = await axios.post(
            `${TRANSLATION_SERVICE_URL}/translate`, 
            {
                text: trimmedText,
                source: source,
                target: target
            }, 
            {
                timeout: 30000, // Tăng timeout lên 30 giây
                headers: { 'Content-Type': 'application/json' }
            }
        );

        if (response.status === 200 && response.data) {
        logger.info('Nhận phản hồi dịch thành công từ Translation service.');
            return response.data;
        } else {
            logger.error(`Phản hồi không hợp lệ từ Translation service: ${JSON.stringify(response.data)}`);
            return { error: 'Invalid response from translation service', details: response.data };
        }
    } catch (error) {
        // Cải thiện xử lý lỗi
        if (error.code === 'ECONNREFUSED') {
            logger.error(`Không thể kết nối đến Translation service tại ${TRANSLATION_SERVICE_URL}/translate`);
            return { 
                error: 'Connection refused', 
                translated: `[Lỗi kết nối] ${textToTranslate.substring(0, 50)}...` 
            };
        } else if (error.code === 'ETIMEDOUT' || error.message.includes('timeout')) {
            logger.error(`Quá thời gian chờ kết nối đến Translation service: ${error.message}`);
            
            // Trả về văn bản nguyên gốc thay vì lỗi khi timeout
            return { 
                error: 'Timeout', 
                translated: `${textToTranslate.substring(0, 50)}... [Chưa dịch - timeout]` 
            };
        } else {
            logger.error(`Lỗi khi gọi Translation service tại ${TRANSLATION_SERVICE_URL}/translate:`, error.message);
            
            // Trả về văn bản nguyên gốc thay vì lỗi trong các trường hợp khác
            return { 
                error: error.message, 
                translated: `${textToTranslate.substring(0, 50)}... [Chưa dịch]` 
            };
        }
    }
};

/**
 * Kiểm tra sức khỏe của dịch vụ dịch thuật.
 * @returns {Promise<boolean>} true nếu dịch vụ đang hoạt động, ngược lại false.
 */
const checkTranslationServiceHealth = async () => {
    try {
        const response = await axios.get(`${TRANSLATION_SERVICE_URL}/health`, { timeout: 5000 });
        if (response.status === 200) {
            logger.info('Translation service is healthy.');
            return true;
        } else {
            logger.warn('Translation service returned non-200 status code:', response.status);
            return false;
        }
    } catch (error) {
        logger.error('Error checking Translation service health:', error.message);
        return false;
    }
};

module.exports = {
    translateTextViaHttp,
    checkTranslationServiceHealth
}; 
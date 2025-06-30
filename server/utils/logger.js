// server/utils/logger.js
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Tạo thư mục logs nếu chưa tồn tại
const logDir = 'logs';
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

/**
 * Tạo logger với cấu hình tùy chỉnh
 * @param {string} serviceName - Tên của service cần log
 * @returns {winston.Logger} - Winston logger instance
 */
function createLogger(serviceName) {
  const logFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}] [${serviceName}]: ${message}`;
    
    if (Object.keys(metadata).length > 0) {
      msg += JSON.stringify(metadata);
    }
    
    return msg;
  });

  // Tạo file transports một cách an toàn
  const createSafeFileTransport = (filename, level) => {
    try {
      // Tạo file trống nếu chưa tồn tại
      if (!fs.existsSync(filename)) {
        fs.writeFileSync(filename, '', { flag: 'w' });
      }
      
      // Kiểm tra quyền ghi
      fs.accessSync(filename, fs.constants.W_OK);
      
      return new winston.transports.File({ 
        filename, 
        level,
        handleExceptions: true,
        // Xử lý lỗi khi không thể ghi file
        handleRejections: true
      });
    } catch (error) {
      console.warn(`Không thể tạo file transport cho ${filename}: ${error.message}`);
      // Trả về một memory stream transport thay thế
      return new winston.transports.Stream({
        stream: new require('stream').Writable({
          write(chunk, encoding, callback) {
            callback();
          }
        }),
        level
      });
    }
  };

  // Tạo danh sách transports
  let transports = [
    // Console transport luôn được sử dụng
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        logFormat
      )
    })
  ];

  // Thêm file transports nếu có thể
  try {
    // Tạo file error log
    const errorLogPath = path.join(logDir, `${serviceName}-error.log`);
    const combinedLogPath = path.join(logDir, `${serviceName}-combined.log`);
    
    // Thử thêm file transports
    transports.push(createSafeFileTransport(errorLogPath, 'error'));
    transports.push(createSafeFileTransport(combinedLogPath));
  } catch (error) {
    console.warn(`Không thể tạo file transport cho ${serviceName}: ${error.message}`);
  }

  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.splat(),
      winston.format.json()
    ),
    defaultMeta: { service: serviceName },
    transports: transports,
    // Không dừng khi gặp lỗi
    exitOnError: false
  });

  return logger;
}

module.exports = { createLogger };
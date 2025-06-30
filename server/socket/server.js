// server/socket-server.js - Socket.IO Server
console.log('SOCKET-SERVER.JS EXECUTION STARTED');

const path = require('path'); // Đảm bảo path được require
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

let حوالي_http, حوالي_Server, حوالي_express, حوالي_cors, حوالي_createLogger, حوالي_socketController, حوالي_speechService, حوالي_translationService;
let logger;
let حوالي_streamHandler; // Thêm streamHandler

try {
  require('dotenv').config();
  حوالي_http = require('http');
  const { Server } = require('socket.io');
  حوالي_Server = Server;
  // const redis = require('redis'); // Redis hiện tại đang tắt
  حوالي_express = require('express');
  حوالي_cors = require('cors');
} catch (e) {
  console.error('ERROR DURING CORE MODULES IMPORT:', e);
  process.exit(1);
}

try {
  حوالي_createLogger = require('../utils/logger').createLogger;
  logger = حوالي_createLogger('socket-server');
  logger.info('Logger initialized successfully.');
} catch (e) {
  console.error('ERROR INITIALIZING LOGGER or importing createLogger:', e);
  // Nếu logger lỗi, dùng console.log
  console.log('Logger initialization failed. Subsequent logs might be missing.');
  // Gán một logger giả để code sau không bị lỗi nếu gọi logger.info ví dụ
  logger = { info: console.log, warn: console.warn, error: console.error, debug: console.log };
}

try {
  logger.info('Importing socketController...');
  حوالي_socketController = require('./socketController');
  logger.info('Importing streamHandler...'); // Thêm log cho streamHandler
  حوالي_streamHandler = require('./streamHandler'); // Thêm import streamHandler
  logger.info('Importing speechService...');
  حوالي_speechService = require('../services/asr/speechService');
  logger.info('Importing translationService...');
  حوالي_translationService = require('../services/translation/translationService');
  logger.info('Custom modules imported successfully.');
} catch (e) {
  logger.error('ERROR DURING CUSTOM MODULES IMPORT:', e);
  process.exit(1);
}

// Sử dụng các biến đã import một cách an toàn
const http = حوالي_http;
const { Server: SocketIOServer } = { Server: حوالي_Server }; // Đảm bảo không xung đột tên biến Server
const express = حوالي_express;
const cors = حوالي_cors;
const socketController = حوالي_socketController;
const streamHandler = حوالي_streamHandler; // Thêm streamHandler
const speechService = حوالي_speechService;
const translationService = حوالي_translationService;


// Mock Redis client (vì Redis đang tắt)
const redisClient = {
  connect: async () => logger.info('Redis disabled, using mock client'),
  set: async () => true,
  get: async () => null,
  quit: async () => true,
  on: () => {},
};

const app = express();
app.use(cors());
const server = http.createServer(app);

const io = new SocketIOServer(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  path: '/socket.io/',
  transports: ['websocket', 'polling'],
  pingTimeout: 30000,
  pingInterval: 15000,
});

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok', 
    asr_service_status: speechService.getModelInfo(),
    translation_service_status: translationService.getModelInfo() // Thêm thông tin translation service
  });
});

app.get('/socket.io/', (req, res) => {
  res.send('Socket.IO server is running');
});

app.get('/', (req, res) => {
  res.json({
    message: 'Video Call Translation Socket.IO Server',
    path: '/socket.io/',
    status: 'running',
    asr_service: speechService.getModelInfo(),
    translation_service: translationService.getModelInfo(), // Thêm thông tin translation service
    timestamp: new Date().toISOString(),
  });
});

const SOCKET_PORT = process.env.PORT || 5001;

/**
 * Kiểm tra kết nối đến PhoWhisper ASR HTTP Service.
 */
async function checkASRServiceConnection() {
  try {
    const modelLoaded = await speechService.loadModel(); // loadModel giờ kiểm tra ASR HTTP service
    if (modelLoaded) {
      logger.info('PhoWhisper ASR HTTP Service is connected and model seems loaded!');
      console.log('✅ PhoWhisper ASR HTTP Service is connected!');
    } else {
      logger.warn('Could not connect to PhoWhisper ASR HTTP Service. Recognition might fail.');
      console.warn('⚠️ Could not connect to PhoWhisper ASR HTTP Service.');
    }
    return modelLoaded;
  } catch (error) {
    logger.error('Error checking PhoWhisper ASR HTTP Service connection:', error);
    console.error('❌ Error checking PhoWhisper ASR HTTP Service connection:', error.message);
    return false;
  }
}

async function checkTranslationServiceConnection() {
  try {
    const loaded = await translationService.checkConnection(); // Sử dụng hàm checkConnection từ translationService
    if (loaded) {
      logger.info('Translation HTTP Service is connected!');
    } else {
      logger.warn('Could not connect to Translation HTTP Service.');
    }
    return loaded;
  } catch (error) {
    logger.error('Error checking Translation Service connection:', error.message);
    return false;
  }
}

// Thiết lập kiểm tra sức khỏe định kỳ cho ASR service
function setupPeriodicHealthChecks() {
  logger.info('Setting up periodic health checks for ASR and Translation services...');
  
  const runChecks = async () => {
    console.log('[HOP DEBUG] Periodically checking ASR HTTP service connection...');
    await checkASRServiceConnection();
    console.log('[HOP DEBUG] Periodically checking Translation HTTP service connection...');
    await checkTranslationServiceConnection();
  };

  // Chạy kiểm tra lần đầu ngay
  runChecks(); 

  const healthCheckInterval = setInterval(runChecks, 90000); // Kiểm tra mỗi 90 giây (tăng lên một chút)

  process.on('SIGTERM', () => {
    clearInterval(healthCheckInterval);
  });
  return healthCheckInterval;
}

// Kết nối Redis (mock) và khởi động server
(async () => {
  try {
    logger.info('Attempting to connect to mock Redis and start server...'); // Log mới
    await redisClient.connect(); 

    setupPeriodicHealthChecks();

    // Cấu hình Socket.IO cho cả các kết nối thông thường và stream
    configureSocket(io, redisClient);
    
    // Cấu hình Stream handler cho real-time translation
    logger.info('Setting up stream handler for continuous real-time translation...');
    streamHandler.setup(io);

    server.listen(SOCKET_PORT, () => {
      logger.info(`Socket.IO server running on port ${SOCKET_PORT}`);
      logger.info(`Socket.IO available at: http://localhost:${SOCKET_PORT}/socket.io/`);
      logger.info(`Stream endpoint available at: http://localhost:${SOCKET_PORT}/stream`);
      logger.info(`ASR Service URL (for Node.js backend): ${process.env.PHOWHISPER_ASR_URL}`);
      logger.info(`Translation Service URL (Node.js backend): ${process.env.TRANSLATION_SERVICE_URL}`);
    });
    logger.info('Server listen command issued.'); // Log mới
  } catch (err) {
    logger.error('Error during server startup (within main async block):', err);
    // Ngay cả khi có lỗi, vẫn cố gắng khởi động các phần khác nếu có thể
    // Tuy nhiên, nếu lỗi ở đây quá nghiêm trọng, server có thể không listen
    // Cân nhắc có nên setupPeriodicHealthChecks và configureSocket ở đây không nếu redisClient.connect thất bại
    // Hoặc nếu các hàm setup/configure ném lỗi
    // Hiện tại, nếu redisClient.connect() ném lỗi, các hàm sau vẫn chạy, nhưng có thể không phải là điều mong muốn
    
    // Thử khởi động lại một cách an toàn hơn nếu có lỗi
    try {
        logger.warn('Attempting to start server in a degraded state due to previous errors...');
        setupPeriodicHealthChecks(); // Có thể ném lỗi nếu logger giả được dùng và hàm này không kiểm tra
        configureSocket(io, null); // redisClient sẽ là null
        server.listen(SOCKET_PORT, () => {
          logger.info(`Socket.IO server running on port ${SOCKET_PORT} (with potential startup errors)`);
        });
        logger.info('Server listen command issued (in catch block).'); // Log mới
    } catch (finalError) {
        logger.error('CRITICAL ERROR: Could not start server even in degraded state:', finalError);
        process.exit(1); // Thoát nếu không thể khởi động server
    }
  }
})();

// Cấu hình Socket.IO
function configureSocket(io, currentRedisClient) {
  logger.info('Configuring Socket.IO event handlers...');
  io.on('connection', (socket) => {
    logger.info('Client connected:', socket.id);

    socket.on('signal', (data) => {
      socketController.handleSignal(socket, data, currentRedisClient);
    });

    socket.on('ice-candidate', (data) => {
      socketController.handleIceCandidate(socket, data, currentRedisClient);
    });

    socket.on('join-room', (roomId, userId) => {
      socketController.handleJoinRoom(socket, roomId, userId, currentRedisClient);
    });

    socket.on('audio-stream', (data) => {
      socketController.handleAudioStream(socket, data, currentRedisClient);
    });

    socket.on('translate-text', (data) => {
      socketController.handleTranslateText(socket, data, currentRedisClient);
    });

    // UI control events
    socket.on('toggle_subtitles', (data) => {
      socketController.handleToggleSubtitles(socket, data, currentRedisClient);
    });

    socket.on('toggle_tts', (data) => {
      socketController.handleToggleTTS(socket, data, currentRedisClient);
    });
    
    socket.on('get_ui_state', () => {
      socketController.handleGetUIState(socket, currentRedisClient);
    });

    // Thêm sự kiện stop-recognition
    socket.on('stop-recognition', (data) => {
      socketController.handleStopRecognition(socket, data);
    });

    /* // Tạm thời comment out do handleGenerateSubtitle đã bị comment
    socket.on('generate-subtitle', (data) => {
      socketController.handleGenerateSubtitle(socket, data, currentRedisClient);
    });
    */

    // Xử lý stream-video
    socket.on('stream-video', (data) => {
      streamHandler.handleStreamVideo(socket, data, currentRedisClient);
    });

    // User management events
    socket.on('user-login', (userData) => {
      socketController.handleUserLogin(socket, userData, currentRedisClient);
    });

    socket.on('user-logout', (userId) => {
      socketController.handleUserLogout(socket, userId, currentRedisClient);
    });

    // Call signaling events
    socket.on('call-user', (data) => {
      socketController.handleCallUser(socket, data, currentRedisClient);
    });

    socket.on('call-accepted', (data) => {
      socketController.handleCallAccepted(socket, data, currentRedisClient);
    });

    socket.on('call-rejected', (data) => {
      socketController.handleCallRejected(socket, data, currentRedisClient);
    });

    socket.on('call-ended', (data) => {
      socketController.handleCallEnded(socket, data, currentRedisClient);
    });

    socket.on('disconnect', () => {
      logger.info('Client disconnected:', socket.id);
      socketController.handleUserDisconnect(socket, currentRedisClient);
    });
  });
  logger.info('Socket.IO event handlers configured.');
}

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    redisClient.quit().then(() => {
      logger.info('Redis client disconnected (mock)');
      process.exit(0);
    }).catch(err => {
        logger.error('Error quitting mock Redis client:', err);
        process.exit(1);
    });
  });
});

module.exports = { io, redisClient };
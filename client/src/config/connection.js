// client/src/config/connection.js
/**
 * Các cấu hình kết nối cho client
 */

// Môi trường phát triển
const devConfig = {
  apiUrl: 'http://localhost:5000/api',
  socketUrl: 'http://localhost:5001', // Đảm bảo cổng này khớp với socket-server
  healthCheckUrl: 'http://localhost:5000/health',
  socketOptions: {
    path: '/socket.io/',
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 5000,
    timeout: 30000,
    autoConnect: true,
    forceNew: true
  },
  rtcConfig: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      // TURN servers for NAT traversal - required for cross-network calls
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject', 
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    iceCandidatePoolSize: 10
  },
  supportedLanguages: [
    { code: 'vi', name: 'Tiếng Việt' },
    { code: 'en', name: 'English' }
  ]
};

// Môi trường production
const prodConfig = {
  apiUrl: '/api',
  socketUrl: '/',
  healthCheckUrl: '/health',
  socketOptions: {
    path: '/socket.io/',
    transports: ['websocket', 'polling'],
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 5000,
    timeout: 30000,
    autoConnect: true,
    forceNew: true
  },
  rtcConfig: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:global.stun.twilio.com:3478' },
      // TURN servers for NAT traversal - required for cross-network calls
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject', 
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    iceCandidatePoolSize: 10
  },
  supportedLanguages: [
    { code: 'vi', name: 'Tiếng Việt' },
    { code: 'en', name: 'English' }
  ]
};

// Chọn cấu hình dựa vào môi trường
const config = process.env.NODE_ENV === 'production' ? prodConfig : devConfig;

// Debug log
console.log('Client config:', config);

export default config;
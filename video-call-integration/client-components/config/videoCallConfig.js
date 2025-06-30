// Video Call Integration Configuration
// Copy this file to your React project and update URLs as needed

export const VIDEO_CALL_CONFIG = {
  // Server URLs
  serverUrl: 'https://34.142.175.163:3001',
  apiUrl: 'https://34.142.175.163/video-call-api',
  wsUrl: 'wss://34.142.175.163/video-call-socket.io',
  
  // Fallback URLs for development
  devServerUrl: 'http://localhost:3001',
  devApiUrl: 'http://localhost:3001/api',
  devWsUrl: 'ws://localhost:3001/socket.io',
  
  // API Configuration
  apiTimeout: 10000,
  retryAttempts: 3,
  retryDelay: 1000,
    // WebRTC Configuration
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
  
  // Media Constraints
  videoConstraints: {
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30, max: 60 }
  },
  
  audioConstraints: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  },
  
  // UI Configuration
  theme: {
    primary: '#007bff',
    secondary: '#6c757d',
    success: '#28a745',
    danger: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8'
  },
  
  // Features
  features: {
    translation: true,
    chat: true,
    screenShare: true,
    recording: false, // Requires additional setup
    fileTransfer: true
  },
  
  // Translation Configuration (if integrated with existing system)
  translation: {
    enabled: true,
    apiUrl: 'https://34.142.175.163/api',
    languages: [
      { code: 'vi', name: 'Tiếng Việt' },
      { code: 'en', name: 'English' },
      { code: 'zh', name: '中文' },
      { code: 'ja', name: '日本語' },
      { code: 'ko', name: '한국어' }
    ],
    defaultSource: 'vi',
    defaultTarget: 'en'
  },
  
  // Socket.IO Configuration
  socketOptions: {
    transports: ['websocket', 'polling'],
    timeout: 5000,
    forceNew: false,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  }
};

// Environment-specific configuration
export const getConfig = () => {
  const isDev = process.env.NODE_ENV === 'development';
  
  return {
    ...VIDEO_CALL_CONFIG,
    serverUrl: isDev ? VIDEO_CALL_CONFIG.devServerUrl : VIDEO_CALL_CONFIG.serverUrl,
    apiUrl: isDev ? VIDEO_CALL_CONFIG.devApiUrl : VIDEO_CALL_CONFIG.apiUrl,
    wsUrl: isDev ? VIDEO_CALL_CONFIG.devWsUrl : VIDEO_CALL_CONFIG.wsUrl
  };
};

export default VIDEO_CALL_CONFIG;

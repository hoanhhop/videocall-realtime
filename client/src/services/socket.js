// client/src/services/socket.js
import { io } from 'socket.io-client';

/**
 * Initialize and configure Socket.io client
 * @param {string} url - Socket server URL 
 * @returns {Socket} Socket.io client instance
 */
export const initializeSocket = (url) => {
  try {
    // Thay đổi URL mặc định từ 8081 thành 5001
    const socketUrl = url || 'http://localhost:5001';
    
    // Configure socket with proper options
    const socketOptions = {
      path: '/socket.io/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10, // Tăng số lần thử kết nối
      reconnectionDelay: 1000,
      timeout: 20000,
      autoConnect: true,
      forceNew: true
    };
    
    console.log('🔌 Đang kết nối Socket.io đến:', socketUrl);
    const socket = io(socketUrl, socketOptions);
    
    // Add listeners for connection status
    socket.on('connect', () => {
      console.log('✅ Socket.io đã kết nối:', socket.id);
    });
    
    socket.on('connect_error', (error) => {
      console.error('❌ Lỗi kết nối Socket.io:', error);
    });
    
    socket.on('disconnect', (reason) => {
      console.log('⚠️ Socket.io đã ngắt kết nối:', reason);
    });
    
    socket.on('error', (error) => {
      console.error('❌ Lỗi Socket.io:', error);
    });
    
    // Thêm listener cho transcription result
    socket.on('transcription-result', (data) => {
      console.log('📝 Kết quả nhận diện:', data);
    });
    
    // Thêm listener cho transcription error
    socket.on('transcription-error', (error) => {
      console.error('❌ Lỗi nhận diện:', error);
    });
    
    return socket;
  } catch (error) {
    console.error('❌ Lỗi khởi tạo Socket.io:', error);
    throw error;
  }
};

export default {
  initializeSocket
};
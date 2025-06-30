// server/config/socket.js
const socketController = require('../controllers/socketController');

/**
 * Configure Socket.io with event handlers
 * @param {SocketIO.Server} io - Socket.io server instance
 */
const configureSocket = (io) => {
  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Handle signaling for WebRTC
    socket.on('signal', (data) => {
      socketController.handleSignal(socket, data);
    });
    
    // Handle room joins for multi-user video calls
    socket.on('join-room', (roomId, userId) => {
      socketController.handleJoinRoom(socket, roomId, userId);
    });
    
    // Handle audio chunk for transcription
    socket.on('audio-stream', (data) => {
      socketController.handleAudioStream(socket, data);
    });
    
    // Handle translation request
    socket.on('translate-text', (data) => {
      socketController.handleTranslateText(socket, data);
    });
    
    // Handle subtitle request
    socket.on('generate-subtitle', (data) => {
      socketController.handleGenerateSubtitle(socket, data);
    });
    
    // Disconnect event
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
    });
  });
};

module.exports = configureSocket;
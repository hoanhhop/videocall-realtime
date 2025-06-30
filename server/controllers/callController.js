// server/controllers/callController.js
const { createLogger } = require('../utils/logger');
const { getUserById, getOnlineUsers } = require('./authController');

const logger = createLogger('call-controller');

// In-memory call storage
const activeCalls = new Map();
const callHistory = [];

const callController = {
  // Handle call initiation
  handleInitiateCall: (socket, io, callData) => {
    try {
      const { caller, callee, callId } = callData;
      
      logger.info(`Call initiated: ${caller.username} -> ${callee.username} (${callId})`);
      
      // Store active call
      const call = {
        ...callData,
        status: 'pending',
        startTime: Date.now(),
        calleeSocketId: null,
        callerSocketId: socket.id
      };
      
      activeCalls.set(callId, call);
      
      // Find callee's socket
      const calleeSocket = findUserSocket(io, callee.id);
      
      if (calleeSocket) {
        call.calleeSocketId = calleeSocket.id;
        calleeSocket.emit('incoming-call', callData);
        
        // Set timeout for call (30 seconds)
        setTimeout(() => {
          if (activeCalls.has(callId) && activeCalls.get(callId).status === 'pending') {
            callController.handleCallTimeout(io, callId);
          }
        }, 30000);
        
        logger.info(`Incoming call sent to ${callee.username}`);
      } else {
        // User is offline
        socket.emit('call-failed', {
          callId,
          reason: 'User is offline',
          callee
        });
        activeCalls.delete(callId);
        logger.warn(`Call failed: ${callee.username} is offline`);
      }
      
    } catch (error) {
      logger.error('Error initiating call:', error);
      socket.emit('call-error', { message: 'Failed to initiate call' });
    }
  },

  // Handle call acceptance
  handleAcceptCall: (socket, io, callData) => {
    try {
      const { callId, caller, callee } = callData;
      
      if (!activeCalls.has(callId)) {
        socket.emit('call-error', { message: 'Call not found' });
        return;
      }
      
      const call = activeCalls.get(callId);
      call.status = 'accepted';
      call.acceptTime = Date.now();
      
      logger.info(`Call accepted: ${caller.username} <-> ${callee.username} (${callId})`);
      
      // Generate room ID for WebRTC
      const roomId = `call_${callId}`;
      call.roomId = roomId;
      
      // Notify caller
      const callerSocket = io.sockets.sockets.get(call.callerSocketId);
      if (callerSocket) {
        callerSocket.emit('call-accepted', {
          ...callData,
          roomId
        });
      }
      
      // Notify callee (current socket)
      socket.emit('call-accepted', {
        ...callData,
        roomId
      });
      
    } catch (error) {
      logger.error('Error accepting call:', error);
      socket.emit('call-error', { message: 'Failed to accept call' });
    }
  },

  // Handle call rejection
  handleRejectCall: (socket, io, callData) => {
    try {
      const { callId, caller, callee } = callData;
      
      if (!activeCalls.has(callId)) {
        return;
      }
      
      const call = activeCalls.get(callId);
      call.status = 'rejected';
      call.endTime = Date.now();
      
      logger.info(`Call rejected: ${caller.username} rejected by ${callee.username} (${callId})`);
      
      // Notify caller
      const callerSocket = io.sockets.sockets.get(call.callerSocketId);
      if (callerSocket) {
        callerSocket.emit('call-rejected', callData);
      }
      
      // Add to history and cleanup
      addToCallHistory(call);
      activeCalls.delete(callId);
      
    } catch (error) {
      logger.error('Error rejecting call:', error);
    }
  },

  // Handle call ending
  handleEndCall: (socket, io, callData) => {
    try {
      const { callId, endedBy } = callData;
      
      if (!activeCalls.has(callId)) {
        return;
      }
      
      const call = activeCalls.get(callId);
      call.status = 'ended';
      call.endTime = Date.now();
      call.endedBy = endedBy;
      call.duration = call.endTime - (call.acceptTime || call.startTime);
      
      logger.info(`Call ended: ${call.caller.username} <-> ${call.callee.username} (${callId})`);
      
      // Notify both parties
      const callerSocket = io.sockets.sockets.get(call.callerSocketId);
      const calleeSocket = io.sockets.sockets.get(call.calleeSocketId);
      
      [callerSocket, calleeSocket].forEach(sock => {
        if (sock) {
          sock.emit('call-ended', {
            callId,
            duration: call.duration,
            endedBy
          });
        }
      });
      
      // Add to history and cleanup
      addToCallHistory(call);
      activeCalls.delete(callId);
      
    } catch (error) {
      logger.error('Error ending call:', error);
    }
  },

  // Handle call timeout
  handleCallTimeout: (io, callId) => {
    try {
      if (!activeCalls.has(callId)) {
        return;
      }
      
      const call = activeCalls.get(callId);
      call.status = 'timeout';
      call.endTime = Date.now();
      
      logger.info(`Call timeout: ${call.caller.username} -> ${call.callee.username} (${callId})`);
      
      // Notify both parties
      const callerSocket = io.sockets.sockets.get(call.callerSocketId);
      const calleeSocket = io.sockets.sockets.get(call.calleeSocketId);
      
      [callerSocket, calleeSocket].forEach(sock => {
        if (sock) {
          sock.emit('call-timeout', {
            callId,
            caller: call.caller,
            callee: call.callee
          });
        }
      });
      
      // Add to history and cleanup
      addToCallHistory(call);
      activeCalls.delete(callId);
      
    } catch (error) {
      logger.error('Error handling call timeout:', error);
    }
  },
  // Get call history for user
  getCallHistory: (req, res) => {
    try {
      const { userId } = req.params;
      
      const userCallHistory = callHistory
        .filter(call => 
          call.caller.id === userId || call.callee.id === userId
        )
        .sort((a, b) => b.startTime - a.startTime)
        .slice(0, 50); // Last 50 calls
      
      res.json({ callHistory: userCallHistory });
      
    } catch (error) {
      logger.error('Error getting call history:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // Get active calls for a specific user
  getActiveCallsForUser: (userId) => {
    try {
      const userActiveCalls = [];
      for (const [callId, call] of activeCalls) {
        if (call.callerId === userId || call.targetUserId === userId) {
          userActiveCalls.push(call);
        }
      }
      return userActiveCalls;
    } catch (error) {
      logger.error('Error getting active calls for user:', error);
      return [];
    }
  },

  // Initiate call (for socket controller)
  initiateCall: (callerId, targetUserId, roomId) => {
    try {
      const callId = Date.now().toString() + Math.random().toString(36).substring(2, 5);
      
      const call = {
        id: callId,
        callerId,
        targetUserId,
        roomId,
        status: 'pending',
        startTime: Date.now(),
        endTime: null
      };
      
      activeCalls.set(callId, call);
      
      // Set timeout for call (30 seconds)
      setTimeout(() => {
        if (activeCalls.has(callId) && activeCalls.get(callId).status === 'pending') {
          callController.rejectCall(callId, 'timeout');
        }
      }, 30000);
      
      logger.info(`Call initiated: ${callerId} -> ${targetUserId} (${callId})`);
      return call;
      
    } catch (error) {
      logger.error('Error initiating call:', error);
      return null;
    }
  },

  // Accept call (for socket controller)
  acceptCall: (callId, userId) => {
    try {
      const call = activeCalls.get(callId);
      
      if (!call) {
        logger.warn(`Call ${callId} not found for acceptance`);
        return null;
      }
      
      if (call.targetUserId !== userId) {
        logger.warn(`User ${userId} not authorized to accept call ${callId}`);
        return null;
      }
      
      if (call.status !== 'pending') {
        logger.warn(`Call ${callId} is not in pending state (current: ${call.status})`);
        return null;
      }
      
      call.status = 'active';
      call.acceptedAt = Date.now();
      
      logger.info(`Call ${callId} accepted by ${userId}`);
      return call;
      
    } catch (error) {
      logger.error('Error accepting call:', error);
      return null;
    }
  },

  // Reject call (for socket controller)
  rejectCall: (callId, userId) => {
    try {
      const call = activeCalls.get(callId);
      
      if (!call) {
        logger.warn(`Call ${callId} not found for rejection`);
        return null;
      }
      
      if (call.targetUserId !== userId && userId !== 'timeout') {
        logger.warn(`User ${userId} not authorized to reject call ${callId}`);
        return null;
      }
      
      call.status = 'rejected';
      call.endTime = Date.now();
      call.rejectedBy = userId;
      
      // Move to history and remove from active calls
      addToCallHistory(call);
      activeCalls.delete(callId);
      
      logger.info(`Call ${callId} rejected by ${userId}`);
      return call;
      
    } catch (error) {
      logger.error('Error rejecting call:', error);
      return null;
    }
  },

  // End call (for socket controller)
  endCall: (callId, userId) => {
    try {
      const call = activeCalls.get(callId);
      
      if (!call) {
        logger.warn(`Call ${callId} not found for ending`);
        return null;
      }
      
      if (call.callerId !== userId && call.targetUserId !== userId) {
        logger.warn(`User ${userId} not authorized to end call ${callId}`);
        return null;
      }
      
      call.status = 'ended';
      call.endTime = Date.now();
      call.endedBy = userId;
      
      // Move to history and remove from active calls
      addToCallHistory(call);
      activeCalls.delete(callId);
      
      logger.info(`Call ${callId} ended by ${userId}`);
      return call;
      
    } catch (error) {
      logger.error('Error ending call:', error);
      return null;
    }
  }
};

// Helper functions
const findUserSocket = (io, userId) => {
  for (const [socketId, socket] of io.sockets.sockets) {
    if (socket.data && socket.data.userId === userId) {
      return socket;
    }
  }
  return null;
};

const addToCallHistory = (call) => {
  callHistory.unshift(call);
  // Keep only last 1000 calls
  if (callHistory.length > 1000) {
    callHistory.length = 1000;
  }
};

module.exports = callController;

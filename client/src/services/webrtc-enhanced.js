// client/src/services/webrtc-enhanced.js
import SimplePeer from 'simple-peer';
import config from '../config/connection';

/**
 * Enhanced WebRTC Service with improved NAT traversal for cross-network calls
 * This fixes the "Connection failed" issue when users are on different networks
 */
class EnhancedWebRTCService {
  constructor() {
    this.peers = new Map();
    this.localStream = null;
    this.socket = null;
    this.userId = null;
    this.roomId = null;
    this.eventCallbacks = new Map();
    this.connectionTimeouts = new Map();
    this.retryAttempts = new Map();
    this.maxRetries = 3;
  }

  initialize(socket, userId) {
    this.socket = socket;
    this.userId = userId;
    this.setupSocketListeners();
    console.log('🔧 Enhanced WebRTC Service initialized for user:', userId);
  }

  setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on('signal', (data) => {
      console.log('📡 Received signal:', data.signal?.type, 'from:', data.from);
      const peer = this.peers.get(data.from);
      if (peer && data.signal) {
        try {
          peer.signal(data.signal);
          console.log('✅ Signal processed from:', data.from);
        } catch (err) {
          console.error('❌ Signal processing error:', err);
          this.handleSignalError(data.from, err);
        }
      }
    });

    this.socket.on('ice-candidate', (data) => {
      console.log('🧊 Received ICE candidate from:', data.from);
      const peer = this.peers.get(data.from);
      if (peer && data.candidate) {
        try {
          peer.signal(data.candidate);
          console.log('✅ ICE candidate processed from:', data.from);
        } catch (err) {
          console.error('❌ ICE candidate error:', err);
        }
      }
    });

    this.socket.on('user-joined', (data) => {
      console.log('👤 User joined:', data.userId);
      if (data.userId !== this.userId && !this.peers.has(data.userId)) {
        this.createPeerConnection(data.userId, true);
      }
    });

    this.socket.on('room-users', (data) => {
      console.log('👥 Room users:', data.users);
      if (data.users && data.users.length > 1) {
        data.users.forEach(userId => {
          if (userId !== this.userId && !this.peers.has(userId)) {
            const isInitiator = this.userId < userId;
            console.log(`${isInitiator ? '🚀 INITIATOR' : '📡 RECEIVER'} for:`, userId);
            this.createPeerConnection(userId, isInitiator);
          }
        });
      }
    });

    this.socket.on('user-disconnected', (userId) => {
      console.log('👋 User disconnected:', userId);
      this.removePeerConnection(userId);
    });
  }

  async getUserMedia(constraints = { video: true, audio: true }) {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not available. Requires HTTPS or localhost.');
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      console.log('🎥 Local stream obtained with tracks:', stream.getTracks().length);
      
      // Log track details
      stream.getTracks().forEach(track => {
        console.log(`📹 Track: ${track.kind} - ${track.label} - enabled: ${track.enabled}`);
      });
      
      this.triggerCallback('localStream', stream);
      return stream;
    } catch (err) {
      console.error('❌ getUserMedia error:', err);
      let message = 'Camera/microphone access failed. ';
      
      switch (err.name) {
        case 'NotAllowedError':
          message += 'Please allow camera and microphone permissions.';
          break;
        case 'NotFoundError':
          message += 'No camera or microphone found.';
          break;
        case 'NotSupportedError':
          message += 'Browser does not support media access. Use HTTPS.';
          break;
        case 'NotReadableError':
          message += 'Camera/microphone is already in use.';
          break;
        default:
          message += err.message;
      }
      
      this.triggerCallback('error', { message });
      throw new Error(message);
    }
  }

  async joinRoom(roomId, constraints) {
    try {
      this.roomId = roomId;
      
      // Get user media first
      await this.getUserMedia(constraints);
      
      // Join room via socket
      if (this.socket) {
        this.socket.emit('join-room', roomId, this.userId);
        console.log('🚪 Joined room:', roomId, 'as:', this.userId);
      }
      
    } catch (err) {
      console.error('❌ Join room error:', err);
      this.triggerCallback('error', { message: err.message });
      throw err;
    }
  }

  createPeerConnection(targetUserId, isInitiator = false) {
    try {
      // Clean up existing connection
      if (this.peers.has(targetUserId)) {
        this.peers.get(targetUserId).destroy();
        this.peers.delete(targetUserId);
      }

      if (!this.localStream) {
        console.error('❌ No local stream for peer connection');
        return null;
      }

      console.log(`🤝 Creating peer for: ${targetUserId}, initiator: ${isInitiator}`);

      // Enhanced TURN configuration with multiple servers
      const enhancedConfig = {
        iceServers: [
          // Multiple STUN servers for redundancy
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:global.stun.twilio.com:3478' },
          { urls: 'stun:stun.cloudflare.com:3478' },
          
          // Multiple TURN servers for NAT traversal
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
          },
          
          // Additional TURN servers
          {
            urls: 'turn:relay1.expressturn.com:3478',
            username: 'ef3IIJRG7TSKQ9',
            credential: 'HUMcR9dPaWN8xPX'
          },
          {
            urls: 'turn:standard.relay.metered.ca:80',
            username: 'e2554efad7aeb32a41ff96b4',
            credential: 'jVONJB2fAYKNjqjF'
          }
        ],
        iceCandidatePoolSize: 10,
        iceTransportPolicy: 'all', // Use both STUN and TURN
        bundlePolicy: 'max-bundle',
        rtcpMuxPolicy: 'require'
      };

      const peer = new SimplePeer({
        initiator: isInitiator,
        stream: this.localStream,
        config: enhancedConfig,
        trickle: true,
        allowHalfTrickle: true,
        objectMode: false
      });

      // Set connection timeout
      const timeoutId = setTimeout(() => {
        console.warn('⏰ Connection timeout for:', targetUserId);
        this.handleConnectionTimeout(targetUserId);
      }, 30000); // 30 seconds timeout

      this.connectionTimeouts.set(targetUserId, timeoutId);

      // Enhanced connection state monitoring
      peer._pc.oniceconnectionstatechange = () => {
        const state = peer._pc.iceConnectionState;
        console.log(`🧊 ICE State (${targetUserId}):`, state);
        
        switch (state) {
          case 'checking':
            console.log('🔍 Checking ICE candidates...');
            break;
          case 'connected':
            console.log('✅ ICE connected!');
            this.clearConnectionTimeout(targetUserId);
            this.retryAttempts.delete(targetUserId);
            break;
          case 'completed':
            console.log('🎉 ICE connection completed!');
            break;
          case 'failed':
            console.error('❌ ICE connection failed!');
            this.handleConnectionFailure(targetUserId, peer);
            break;
          case 'disconnected':
            console.warn('⚠️ ICE disconnected');
            this.handleConnectionDisconnected(targetUserId);
            break;
          case 'closed':
            console.log('🔒 ICE connection closed');
            this.clearConnectionTimeout(targetUserId);
            break;
        }
      };

      // Monitor gathering state
      peer._pc.onicegatheringstatechange = () => {
        console.log(`🔗 ICE Gathering (${targetUserId}):`, peer._pc.iceGatheringState);
      };

      // Enhanced ICE candidate logging
      peer._pc.onicecandidate = (event) => {
        if (event.candidate) {
          const candidate = event.candidate;
          console.log(`🧊 ICE Candidate (${targetUserId}):`, {
            type: candidate.type,
            protocol: candidate.protocol,
            address: candidate.address?.substring(0, 10) + '...',
            port: candidate.port,
            priority: candidate.priority
          });
        } else {
          console.log('🏁 ICE gathering complete');
        }
      };

      peer.on('signal', (signal) => {
        console.log(`📡 Signal generated: ${signal.type} for ${this.userId}`);
        
        this.socket.emit('signal', {
          signal,
          to: targetUserId,
          from: this.userId,
          roomId: this.roomId,
          timestamp: Date.now()
        });
      });

      peer.on('connect', () => {
        console.log('🎉 Peer connected with:', targetUserId);
        this.clearConnectionTimeout(targetUserId);
        this.triggerCallback('peer-connected', { userId: targetUserId, peer });
      });

      peer.on('stream', (stream) => {
        console.log('🎥 Remote stream received! Tracks:', stream.getTracks().length);
        console.log('Stream tracks:', stream.getTracks().map(track => 
          `${track.kind}: ${track.enabled ? 'enabled' : 'disabled'}`
        ));
        this.triggerCallback('stream', { userId: targetUserId, stream });
      });

      peer.on('data', (data) => {
        console.log('📨 Data from:', targetUserId, data.toString());
        this.triggerCallback('data', { userId: targetUserId, data: data.toString() });
      });

      peer.on('error', (err) => {
        console.error('❌ Peer error:', err);
        this.triggerCallback('peer-error', { userId: targetUserId, error: err });
        this.handlePeerError(targetUserId, err);
      });

      peer.on('close', () => {
        console.log('🔌 Peer connection closed');
        this.clearConnectionTimeout(targetUserId);
        this.removePeerConnection(targetUserId);
        this.triggerCallback('peer-closed', { userId: targetUserId });
      });

      this.peers.set(targetUserId, peer);
      console.log('✅ Peer connection created successfully');
      
      return peer;
      
    } catch (error) {
      console.error('❌ Failed to create peer:', error);
      this.triggerCallback('error', error);
      return null;
    }
  }

  handleConnectionFailure(targetUserId, peer) {
    console.warn(`🔄 Handling ICE failure for: ${targetUserId}`);
    
    // Get retry count
    const retries = this.retryAttempts.get(targetUserId) || 0;
    
    if (retries < this.maxRetries) {
      this.retryAttempts.set(targetUserId, retries + 1);
      console.log(`🔄 Retry attempt ${retries + 1}/${this.maxRetries} for:`, targetUserId);
      
      // Try ICE restart first
      try {
        if (peer._pc && peer._pc.iceConnectionState === 'failed') {
          peer._pc.restartIce();
          console.log('🔄 ICE restart initiated');
        }
      } catch (err) {
        console.error('❌ ICE restart failed:', err);
      }
      
      // If ICE restart doesn't work, recreate connection
      setTimeout(() => {
        if (peer._pc && peer._pc.iceConnectionState === 'failed') {
          console.log('🔄 Recreating peer connection after ICE restart failure');
          this.removePeerConnection(targetUserId);
          const isInitiator = this.userId < targetUserId;
          this.createPeerConnection(targetUserId, isInitiator);
        }
      }, 3000);
      
    } else {
      console.error('❌ Max retries reached for:', targetUserId);
      this.removePeerConnection(targetUserId);
      this.triggerCallback('connection-failed', { userId: targetUserId });
    }
  }

  handleConnectionTimeout(targetUserId) {
    console.warn('⏰ Connection timeout for:', targetUserId);
    const peer = this.peers.get(targetUserId);
    if (peer && peer._pc.iceConnectionState !== 'connected') {
      this.handleConnectionFailure(targetUserId, peer);
    }
  }

  handleConnectionDisconnected(targetUserId) {
    console.warn('⚠️ Connection disconnected for:', targetUserId);
    // Wait a bit before attempting reconnection
    setTimeout(() => {
      const peer = this.peers.get(targetUserId);
      if (peer && peer._pc.iceConnectionState === 'disconnected') {
        console.log('🔄 Attempting reconnection for:', targetUserId);
        const isInitiator = this.userId < targetUserId;
        this.removePeerConnection(targetUserId);
        this.createPeerConnection(targetUserId, isInitiator);
      }
    }, 5000);
  }

  handleSignalError(targetUserId, error) {
    console.error('❌ Signal error for:', targetUserId, error);
    // Remove and recreate connection on signal error
    setTimeout(() => {
      const isInitiator = this.userId < targetUserId;
      this.removePeerConnection(targetUserId);
      this.createPeerConnection(targetUserId, isInitiator);
    }, 1000);
  }

  handlePeerError(targetUserId, error) {
    console.error('❌ Peer error for:', targetUserId, error);
    this.clearConnectionTimeout(targetUserId);
    
    // Clean up and attempt retry after error
    setTimeout(() => {
      if (!this.peers.has(targetUserId)) {
        const retries = this.retryAttempts.get(targetUserId) || 0;
        if (retries < this.maxRetries) {
          console.log('🔄 Retrying peer connection after error');
          const isInitiator = this.userId < targetUserId;
          this.createPeerConnection(targetUserId, isInitiator);
        }
      }
    }, 2000);
  }

  clearConnectionTimeout(targetUserId) {
    const timeoutId = this.connectionTimeouts.get(targetUserId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      this.connectionTimeouts.delete(targetUserId);
    }
  }

  removePeerConnection(userId) {
    const peer = this.peers.get(userId);
    if (peer) {
      peer.destroy();
      this.peers.delete(userId);
      console.log('🗑️ Peer connection removed for:', userId);
    }
    
    this.clearConnectionTimeout(userId);
    this.retryAttempts.delete(userId);
    this.triggerCallback('peer-disconnected', { userId });
  }

  // Utility methods
  sendData(userId, data) {
    const peer = this.peers.get(userId);
    if (peer && peer.connected) {
      peer.send(data);
      console.log('📤 Data sent to:', userId);
    } else {
      console.warn('⚠️ Cannot send data to:', userId, 'not connected');
    }
  }

  toggleAudio(enabled) {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = enabled;
      });
      console.log('🎤 Audio:', enabled ? 'enabled' : 'disabled');
      return enabled;
    }
    return false;
  }

  toggleVideo(enabled) {
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = enabled;
      });
      console.log('🎥 Video:', enabled ? 'enabled' : 'disabled');
      return enabled;
    }
    return false;
  }

  on(event, callback) {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event).push(callback);
  }

  off(event, callback) {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  triggerCallback(event, data) {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error('Error in callback:', err);
        }
      });
    }
  }

  async getConnectionStats(userId) {
    const peer = this.peers.get(userId);
    if (peer && peer._pc) {
      try {
        const stats = await peer._pc.getStats();
        const statsReport = {};
        
        stats.forEach(report => {
          if (report.type === 'candidate-pair' && report.state === 'succeeded') {
            statsReport.candidatePair = {
              state: report.state,
              nominated: report.nominated,
              writable: report.writable,
              bytesReceived: report.bytesReceived,
              bytesSent: report.bytesSent
            };
          }
          if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
            statsReport.inboundVideo = {
              bytesReceived: report.bytesReceived,
              packetsReceived: report.packetsReceived,
              packetsLost: report.packetsLost
            };
          }
        });
        
        console.log('📊 Connection stats for:', userId, statsReport);
        return statsReport;
      } catch (err) {
        console.error('Error getting stats:', err);
        return null;
      }
    }
    return null;
  }

  cleanup() {
    console.log('🧹 Cleaning up Enhanced WebRTC service');
    
    // Clear all timeouts
    this.connectionTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
    this.connectionTimeouts.clear();
    
    // Destroy peers
    this.peers.forEach((peer, userId) => {
      peer.destroy();
      console.log('🗑️ Destroyed peer for:', userId);
    });
    this.peers.clear();

    // Stop local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.stop();
        console.log('🛑 Stopped track:', track.kind);
      });
      this.localStream = null;
    }

    // Clear state
    this.retryAttempts.clear();
    this.eventCallbacks.clear();

    console.log('✅ Enhanced WebRTC cleanup completed');
  }
}

// Create singleton instance
const enhancedWebRTCService = new EnhancedWebRTCService();

export default enhancedWebRTCService;

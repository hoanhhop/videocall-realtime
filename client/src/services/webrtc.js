// client/src/services/webrtc.js
import SimplePeer from 'simple-peer';
import config from '../config/connection';

/**
 * WebRTC Service for handling peer connections
 * Provides centralized WebRTC functionality with improved NAT traversal
 */
class WebRTCService {
  constructor() {
    this.peers = new Map(); // Store multiple peer connections
    this.localStream = null;
    this.socket = null;
    this.userId = null;
    this.roomId = null;
    this.eventCallbacks = new Map();
  }

  /**
   * Initialize WebRTC service with socket connection
   */
  initialize(socket, userId) {
    this.socket = socket;
    this.userId = userId;
    this.setupSocketListeners();
    console.log('🔧 WebRTC Service initialized for user:', userId);
  }

  /**
   * Setup socket event listeners for WebRTC signaling
   */
  setupSocketListeners() {
    if (!this.socket) return;

    // Handle incoming WebRTC signals
    this.socket.on('signal', (data) => {
      console.log('📡 Received WebRTC signal:', data.signal?.type, 'from:', data.from);
      const peer = this.peers.get(data.from);
      if (peer && data.signal) {
        try {
          peer.signal(data.signal);
          console.log('✅ Signal processed successfully from:', data.from);
        } catch (err) {
          console.error('❌ Error processing signal from:', data.from, err);
        }
      }
    });

    // Handle ICE candidates separately for better control
    this.socket.on('ice-candidate', (data) => {
      console.log('🧊 Received ICE candidate from:', data.from);
      const peer = this.peers.get(data.from);
      if (peer && data.candidate) {
        try {
          peer.signal(data.candidate);
          console.log('✅ ICE candidate processed from:', data.from);
        } catch (err) {
          console.error('❌ Error processing ICE candidate from:', data.from, err);
        }
      }
    });

    // Handle user joining room
    this.socket.on('user-joined', (data) => {
      console.log('👤 User joined room:', data.userId);
      if (data.userId !== this.userId && !this.peers.has(data.userId)) {
        // Create peer connection as initiator for new user
        this.createPeerConnection(data.userId, true);
      }
    });

    // Handle room users list
    this.socket.on('room-users', (data) => {
      console.log('👥 Room users updated:', data.users);
      if (data.users && data.users.length > 1) {
        data.users.forEach(userId => {
          if (userId !== this.userId && !this.peers.has(userId)) {
            // Determine who should be initiator based on user ID order
            const isInitiator = this.userId < userId;
            console.log(`${isInitiator ? '🚀 Creating as INITIATOR' : '📡 Creating as RECEIVER'} for:`, userId);
            this.createPeerConnection(userId, isInitiator);
          }
        });
      }
    });

    // Handle user disconnection
    this.socket.on('user-disconnected', (userId) => {
      console.log('👋 User disconnected:', userId);
      this.removePeerConnection(userId);
    });

    // Handle signal confirmation
    this.socket.on('signal-sent', (data) => {
      console.log('📤 Signal sent confirmation:', data.type);
    });

    // Handle signal errors
    this.socket.on('signal-error', (error) => {
      console.error('❌ Signal error:', error.message);
      this.triggerCallback('error', error);
    });
  }

  /**
   * Get user media stream with enhanced error handling
   */
  async getUserMedia(constraints = { video: true, audio: true }) {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia not available. Please use HTTPS or localhost.');
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.localStream = stream;
      console.log('🎥 Local stream obtained:', stream.getTracks().length, 'tracks');
      
      this.triggerCallback('localStream', stream);
      return stream;
    } catch (err) {
      console.error('❌ Error getting user media:', err);
      let errorMessage = 'Could not access camera or microphone. ';
      
      if (err.name === 'NotAllowedError') {
        errorMessage += 'Please grant camera and microphone permissions.';
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'No camera or microphone found.';
      } else if (err.name === 'NotSupportedError') {
        errorMessage += 'Browser does not support media access.';
      } else {
        errorMessage += err.message;
      }
      
      this.triggerCallback('error', { message: errorMessage });
      throw new Error(errorMessage);
    }
  }

  /**
   * Join a WebRTC room
   */
  async joinRoom(roomId, constraints) {
    try {
      this.roomId = roomId;
      
      // Get user media first
      await this.getUserMedia(constraints);
      
      // Join room via socket
      if (this.socket) {
        this.socket.emit('join-room', roomId, this.userId);
        console.log('🚪 Joining room:', roomId, 'as user:', this.userId);
      }
      
    } catch (err) {
      console.error('❌ Error joining room:', err);
      this.triggerCallback('error', { message: err.message });
      throw err;
    }
  }

  /**
   * Create peer connection with enhanced configuration
   */
  createPeerConnection(remoteUserId, isInitiator) {
    try {
      if (this.peers.has(remoteUserId)) {
        console.log('🔄 Destroying existing peer for:', remoteUserId);
        this.peers.get(remoteUserId).destroy();
      }

      if (!this.localStream) {
        console.error('❌ No local stream available for peer connection');
        return null;
      }

      console.log('🔧 Creating peer connection for:', remoteUserId, 'initiator:', isInitiator);

      const peerOptions = {
        initiator: isInitiator,
        stream: this.localStream,
        trickle: true, // Enable trickle ICE for better connectivity
        config: {
          ...config.rtcConfig,
          // Enhanced ICE configuration for better NAT traversal
          iceTransportPolicy: 'all', // Use both STUN and TURN
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require'
        }
      };

      const peer = new SimplePeer(peerOptions);

      // Handle peer events
      peer.on('signal', (data) => {
        console.log('📡 Peer signal generated:', data.type, 'for:', remoteUserId);
        
        if (this.socket) {
          // Send different events for different signal types
          if (data.type === 'offer' || data.type === 'answer') {
            this.socket.emit('signal', {
              signal: data,
              from: this.userId,
              to: remoteUserId,
              timestamp: Date.now()
            });
          } else if (data.candidate) {
            // Send ICE candidates separately
            this.socket.emit('ice-candidate', {
              candidate: data,
              from: this.userId,
              to: remoteUserId,
              timestamp: Date.now()
            });
          }
        }
      });

      peer.on('stream', (remoteStream) => {
        console.log('🎥 Remote stream received from:', remoteUserId);
        console.log('Stream tracks:', remoteStream.getTracks().map(t => `${t.kind}: ${t.enabled ? 'enabled' : 'disabled'}`));
        this.triggerCallback('remoteStream', { userId: remoteUserId, stream: remoteStream });
      });

      peer.on('connect', () => {
        console.log('🤝 Peer connection established with:', remoteUserId);
        this.triggerCallback('peerConnected', { userId: remoteUserId });
      });

      peer.on('error', (err) => {
        console.error('❌ Peer error with:', remoteUserId, err);
        this.triggerCallback('peerError', { userId: remoteUserId, error: err });
        
        // Attempt to recreate connection after error
        setTimeout(() => {
          if (!this.peers.has(remoteUserId)) {
            console.log('🔄 Attempting to recreate peer connection after error');
            this.createPeerConnection(remoteUserId, isInitiator);
          }
        }, 3000);
      });

      peer.on('close', () => {
        console.log('🔌 Peer connection closed with:', remoteUserId);
        this.peers.delete(remoteUserId);
        this.triggerCallback('peerDisconnected', { userId: remoteUserId });
      });

      peer.on('data', (data) => {
        console.log('📊 Data received from:', remoteUserId, data);
        this.triggerCallback('dataReceived', { userId: remoteUserId, data });
      });

      this.peers.set(remoteUserId, peer);
      console.log('✅ Peer connection created for:', remoteUserId);
      
      return peer;
    } catch (err) {
      console.error('❌ Error creating peer connection for:', remoteUserId, err);
      this.triggerCallback('error', { message: 'Failed to create peer connection: ' + err.message });
      return null;
    }
  }

  /**
   * Remove peer connection
   */
  removePeerConnection(userId) {
    const peer = this.peers.get(userId);
    if (peer) {
      peer.destroy();
      this.peers.delete(userId);
      console.log('🗑️ Peer connection removed for:', userId);
      this.triggerCallback('peerDisconnected', { userId });
    }
  }

  /**
   * Send data to specific peer
   */
  sendData(userId, data) {
    const peer = this.peers.get(userId);
    if (peer && peer.connected) {
      peer.send(data);
      console.log('📤 Data sent to:', userId);
    } else {
      console.warn('⚠️ Cannot send data to:', userId, 'peer not connected');
    }
  }

  /**
   * Send data to all connected peers
   */
  broadcastData(data) {
    this.peers.forEach((peer, userId) => {
      if (peer.connected) {
        peer.send(data);
        console.log('📤 Data broadcasted to:', userId);
      }
    });
  }

  /**
   * Get connection stats for debugging
   */
  async getConnectionStats(userId) {
    const peer = this.peers.get(userId);
    if (peer && peer._pc) {
      try {
        const stats = await peer._pc.getStats();
        return stats;
      } catch (err) {
        console.error('Error getting connection stats:', err);
        return null;
      }
    }
    return null;
  }

  /**
   * Toggle local audio track
   */
  toggleAudio(enabled) {
    if (this.localStream) {
      const audioTracks = this.localStream.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = enabled;
      });
      console.log('🎤 Audio toggled:', enabled ? 'enabled' : 'disabled');
      return enabled;
    }
    return false;
  }

  /**
   * Toggle local video track
   */
  toggleVideo(enabled) {
    if (this.localStream) {
      const videoTracks = this.localStream.getVideoTracks();
      videoTracks.forEach(track => {
        track.enabled = enabled;
      });
      console.log('🎥 Video toggled:', enabled ? 'enabled' : 'disabled');
      return enabled;
    }
    return false;
  }

  /**
   * Register event callback
   */
  on(event, callback) {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, []);
    }
    this.eventCallbacks.get(event).push(callback);
  }

  /**
   * Remove event callback
   */
  off(event, callback) {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Trigger event callback
   */
  triggerCallback(event, data) {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error('Error in event callback:', err);
        }
      });
    }
  }

  /**
   * Clean up all connections and resources
   */
  cleanup() {
    console.log('🧹 Cleaning up WebRTC service');
    
    // Destroy all peer connections
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

    // Clear callbacks
    this.eventCallbacks.clear();

    // Remove socket listeners
    if (this.socket) {
      this.socket.off('signal');
      this.socket.off('ice-candidate');
      this.socket.off('user-joined');
      this.socket.off('room-users');
      this.socket.off('user-disconnected');
      this.socket.off('signal-sent');
      this.socket.off('signal-error');
    }

    console.log('✅ WebRTC service cleanup completed');
  }
}

// Create singleton instance
const webrtcService = new WebRTCService();

export default webrtcService;
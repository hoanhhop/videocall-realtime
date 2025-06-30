// client/src/contexts/CallContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import webrtcService from '../services/webrtc';

const CallContext = createContext();

export const useCall = () => useContext(CallContext);

export const CallProvider = ({ children, socket, user }) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [userId, setUserId] = useState('');
  const [error, setError] = useState(null);
  const [callPartner, setCallPartner] = useState(null);

  // Initialize WebRTC service when socket and user are available
  useEffect(() => {
    if (socket && user) {
      const currentUserId = user?.id || Math.random().toString(36).substring(2, 7);
      setUserId(currentUserId);
      
      console.log('🔧 Initializing WebRTC service for user:', currentUserId);
      
      // Initialize WebRTC service
      webrtcService.initialize(socket, currentUserId);      
      // Set up WebRTC service event listeners
      webrtcService.on('localStream', (stream) => {
        setLocalStream(stream);
        console.log('🎥 Local stream received from WebRTC service');
      });

      webrtcService.on('remoteStream', ({ userId: remoteUserId, stream }) => {
        setRemoteStream(stream);
        setCallPartner({ id: remoteUserId, username: remoteUserId });
        console.log('🎥 Remote stream received from:', remoteUserId);
      });

      webrtcService.on('peerConnected', ({ userId: connectedUserId }) => {
        console.log('🤝 Peer connected:', connectedUserId);
        setError(null); // Clear any connection errors
      });

      webrtcService.on('peerDisconnected', ({ userId: disconnectedUserId }) => {
        console.log('👋 Peer disconnected:', disconnectedUserId);
        if (callPartner?.id === disconnectedUserId) {
          setRemoteStream(null);
          setCallPartner(null);
        }
      });

      webrtcService.on('peerError', ({ userId: errorUserId, error }) => {
        console.error('❌ Peer error with:', errorUserId, error);
        setError(`Connection error with ${errorUserId}: ${error.message}`);
      });

      webrtcService.on('error', ({ message }) => {
        console.error('❌ WebRTC service error:', message);
        setError(message);
      });
    }

    return () => {
      // Cleanup WebRTC service on unmount
      if (webrtcService) {
        webrtcService.cleanup();
      }
    };
  }, [socket, user]);

  // Enhanced room joining with user context using WebRTC service
  const joinCallRoom = async (targetUser, generatedRoomId) => {
    try {
      setIsCallActive(true);
      setCallPartner(targetUser);
      setRoomId(generatedRoomId);
      
      // Use WebRTC service to join room
      await webrtcService.joinRoom(generatedRoomId, { video: true, audio: true });
      
      console.log(`🚪 Joined call room: ${generatedRoomId} as user: ${userId}`);
      
    } catch (err) {
      console.error('Error joining call room:', err);
      setError('Could not access camera or microphone. Please ensure they are connected and permissions are granted.');
      setIsCallActive(false);
    }
  };

  // Start a call - using WebRTC service
  const startCall = async () => {
    try {
      console.log('🎬 Starting call...');
      setError(null);
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('getUserMedia không khả dụng. Trang cần được truy cập qua HTTPS hoặc localhost để sử dụng camera/microphone.');
      }
      
      // Generate random room ID if not set
      const newRoomId = roomId || Math.random().toString(36).substring(2, 7);
      setRoomId(newRoomId);
      
      // Join room through WebRTC service
      await webrtcService.joinRoom(newRoomId, { video: true, audio: true });
      setIsCallActive(true);
      
      console.log('✅ Call started successfully');
    } catch (err) {
      console.error('Error starting call:', err);
      setError('Could not access camera or microphone. Please ensure they are connected and permissions are granted.');
      setIsCallActive(false);
    }
  };
  
  // End a call - using WebRTC service
  const endCall = () => {
    console.log('📴 Ending call...');
    
    // Use WebRTC service cleanup
    webrtcService.cleanup();
    
    setLocalStream(null);
    setRemoteStream(null);
    setIsCallActive(false);
    setCallPartner(null);
    setRoomId('');
    setError(null);
    
    console.log('✅ Call ended successfully');
  };
  
  // Toggle microphone - using WebRTC service
  const toggleMic = () => {
    const newMutedState = !isMicMuted;
    webrtcService.toggleAudio(!newMutedState);
    setIsMicMuted(newMutedState);
    console.log(`🎤 Microphone ${newMutedState ? 'muted' : 'unmuted'}`);
  };
  
  // Toggle video - using WebRTC service
  const toggleVideo = () => {
    const newVideoOffState = !isVideoOff;
    webrtcService.toggleVideo(!newVideoOffState);
    setIsVideoOff(newVideoOffState);
    console.log(`📹 Video ${newVideoOffState ? 'disabled' : 'enabled'}`);
  };

  // Join an existing room - using WebRTC service
  const joinRoom = async (roomIdToJoin) => {
    try {
      setError(null);
      console.log('🚪 Joining room:', roomIdToJoin);
      
      if (!roomIdToJoin) {
        throw new Error('Room ID is required');
      }
      
      setRoomId(roomIdToJoin);
      
      // Use WebRTC service to join room
      await webrtcService.joinRoom(roomIdToJoin, { video: true, audio: true });
      setIsCallActive(true);
      
      console.log(`✅ Successfully joined room: ${roomIdToJoin}`);
    } catch (err) {
      console.error('Error joining room:', err);
      setError('Could not join room: ' + err.message);
    }
  };
    const value = {
    localStream,
    remoteStream,
    isCallActive,
    isMicMuted,
    isVideoOff,
    roomId,
    userId,
    error,
    callPartner,
    startCall,
    endCall,
    toggleMic,
    toggleVideo,
    joinRoom,
    joinCallRoom
  };
  
  return (
    <CallContext.Provider value={value}>
      {children}
    </CallContext.Provider>
  );
};
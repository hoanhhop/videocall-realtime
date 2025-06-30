import React, { createContext, useContext, useState, useEffect } from 'react';
import { initializeSocket } from '../../services/socket';
import VideoCallAPI from '../../services/videoCallAPI';

const VideoCallContext = createContext();

export const useVideoCall = () => {
  const context = useContext(VideoCallContext);
  if (!context) {
    throw new Error('useVideoCall must be used within VideoCallProvider');
  }
  return context;
};

export const VideoCallProvider = ({ 
  children, 
  currentUser, 
  serverUrl = 'http://localhost:5001',
  authToken = null 
}) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);
  const [activeCall, setActiveCall] = useState(null);
  const [callHistory, setCallHistory] = useState([]);
  const [videoCallAPI, setVideoCallAPI] = useState(null);

  // Initialize API and Socket when provider mounts
  useEffect(() => {
    if (!currentUser || !serverUrl) return;

    // Initialize API service
    const api = new VideoCallAPI(serverUrl, authToken);
    setVideoCallAPI(api);

    // Initialize socket connection
    const socketInstance = initializeSocket(serverUrl);
    setSocket(socketInstance);

    // Socket event handlers
    socketInstance.on('connect', async () => {
      setIsConnected(true);
      console.log('Video call socket connected');

      // Validate user with video call server
      try {
        await api.validateUser({
          id: currentUser.id,
          username: currentUser.username || currentUser.name,
          email: currentUser.email,
          avatar: currentUser.avatar || currentUser.profile_picture
        });

        // Register user as online
        socketInstance.emit('user-login', {
          id: currentUser.id,
          username: currentUser.username || currentUser.name,
          avatar: currentUser.avatar || currentUser.profile_picture
        });
      } catch (error) {
        console.error('Error validating user:', error);
      }
    });

    socketInstance.on('disconnect', () => {
      setIsConnected(false);
      console.log('Video call socket disconnected');
    });

    // Online users updates
    socketInstance.on('online-users-updated', (users) => {
      // Filter out current user
      const filteredUsers = users.filter(user => user.id !== currentUser.id);
      setOnlineUsers(filteredUsers);
    });

    // Incoming call handling
    socketInstance.on('incoming-call', (callData) => {
      setIncomingCall(callData);
      
      // Browser notification if supported
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(`Incoming call from ${callData.caller.username}`, {
          icon: callData.caller.avatar,
          tag: 'video-call'
        });
      }
    });

    // Call status updates
    socketInstance.on('call-accepted', (data) => {
      setActiveCall(data);
      setIncomingCall(null);
    });

    socketInstance.on('call-rejected', (data) => {
      setIncomingCall(null);
      // Add to call history as missed
      setCallHistory(prev => [...prev, {
        ...data,
        status: 'rejected',
        timestamp: Date.now()
      }]);
    });

    socketInstance.on('call-ended', (data) => {
      setActiveCall(null);
      setIncomingCall(null);
      // Add to call history
      setCallHistory(prev => [...prev, {
        ...data,
        status: 'ended',
        timestamp: Date.now()
      }]);
    });

    // Cleanup on unmount
    return () => {
      if (socketInstance) {
        socketInstance.emit('user-logout', currentUser.id);
        socketInstance.disconnect();
      }
    };
  }, [currentUser, serverUrl, authToken]);

  // Request notification permission
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Call functions
  const initiateCall = async (targetUser) => {
    if (!socket || !videoCallAPI) return null;

    try {
      const roomId = `room_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Call API to initiate call
      const result = await videoCallAPI.initiateCall(targetUser.id, roomId);
      
      if (result.success) {
        // Emit socket event
        socket.emit('call-user', {
          targetUserId: targetUser.id,
          roomId: roomId
        });

        return {
          callId: result.callId,
          roomId: roomId,
          targetUser: targetUser
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error initiating call:', error);
      return null;
    }
  };

  const acceptCall = () => {
    if (!socket || !incomingCall) return;

    socket.emit('call-accepted', {
      callId: incomingCall.callId,
      roomId: incomingCall.roomId
    });

    setActiveCall({
      callId: incomingCall.callId,
      roomId: incomingCall.roomId,
      partner: incomingCall.caller
    });
  };

  const rejectCall = () => {
    if (!socket || !incomingCall) return;

    socket.emit('call-rejected', {
      callId: incomingCall.callId
    });

    setIncomingCall(null);
  };

  const endCall = () => {
    if (!socket || !activeCall) return;

    socket.emit('call-ended', {
      callId: activeCall.callId,
      roomId: activeCall.roomId
    });

    setActiveCall(null);
  };

  const getOnlineUsers = async () => {
    if (!videoCallAPI) return [];

    try {
      const users = await videoCallAPI.getOnlineUsers();
      return users.filter(user => user.id !== currentUser.id);
    } catch (error) {
      console.error('Error getting online users:', error);
      return [];
    }
  };

  const value = {
    // Connection state
    isConnected,
    socket,
    
    // User data
    currentUser,
    onlineUsers,
    
    // Call state
    incomingCall,
    activeCall,
    callHistory,
    
    // Call functions
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    getOnlineUsers
  };

  return (
    <VideoCallContext.Provider value={value}>
      {children}
    </VideoCallContext.Provider>
  );
};

export default VideoCallContext;

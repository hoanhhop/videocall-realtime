// client/src/contexts/CallNotificationContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { useUser } from './UserContext';

const CallNotificationContext = createContext();

export const useCallNotification = () => useContext(CallNotificationContext);

export const CallNotificationProvider = ({ children, socket }) => {
  const { user } = useUser();
  const [incomingCall, setIncomingCall] = useState(null);
  const [outgoingCall, setOutgoingCall] = useState(null);
  const [callHistory, setCallHistory] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!socket || !user) return;

    // Listen for incoming calls
    socket.on('incoming-call', (callData) => {
      console.log('📞 Incoming call from:', callData.caller.username);
      setIncomingCall(callData);
      
      // Show browser notification if permission granted
      if (Notification.permission === 'granted') {
        new Notification(`Incoming call from ${callData.caller.username}`, {
          body: 'Click to answer',
          icon: '/call-icon.png',
          tag: 'incoming-call'
        });
      }
      
      // Play ringtone
      playRingtone();
    });

    // Listen for call responses
    socket.on('call-accepted', (callData) => {
      console.log('✅ Call accepted by:', callData.callee.username);
      setOutgoingCall(null);
      // Navigate to video call interface
      // This will be handled by the main app component
    });

    socket.on('call-rejected', (callData) => {
      console.log('❌ Call rejected by:', callData.callee.username);
      setOutgoingCall(null);
      addNotification({
        type: 'call-rejected',
        message: `${callData.callee.username} declined your call`,
        timestamp: Date.now()
      });
    });

    socket.on('call-ended', (callData) => {
      console.log('📴 Call ended');
      setIncomingCall(null);
      setOutgoingCall(null);
      stopRingtone();
      
      // Add to call history
      addToCallHistory(callData);
    });

    socket.on('call-timeout', (callData) => {
      console.log('⏰ Call timeout');
      setIncomingCall(null);
      setOutgoingCall(null);
      stopRingtone();
      
      addNotification({
        type: 'missed-call',
        message: `Missed call from ${callData.caller.username}`,
        timestamp: Date.now()
      });
    });

    return () => {
      socket.off('incoming-call');
      socket.off('call-accepted');
      socket.off('call-rejected');
      socket.off('call-ended');
      socket.off('call-timeout');
    };
  }, [socket, user]);

  const initiateCall = (targetUser) => {
    if (!socket || !user) return;

    const callData = {
      caller: user,
      callee: targetUser,
      callId: generateCallId(),
      timestamp: Date.now()
    };

    setOutgoingCall(callData);
    socket.emit('initiate-call', callData);
    
    console.log('📞 Initiating call to:', targetUser.username);
  };

  const acceptCall = () => {
    if (!socket || !incomingCall) return;

    socket.emit('accept-call', {
      callId: incomingCall.callId,
      caller: incomingCall.caller,
      callee: user
    });

    stopRingtone();
    setIncomingCall(null);
    console.log('✅ Call accepted');
  };

  const rejectCall = () => {
    if (!socket || !incomingCall) return;

    socket.emit('reject-call', {
      callId: incomingCall.callId,
      caller: incomingCall.caller,
      callee: user
    });

    stopRingtone();
    setIncomingCall(null);
    console.log('❌ Call rejected');
  };

  const endCall = () => {
    if (!socket) return;

    const callData = outgoingCall || incomingCall;
    if (callData) {
      socket.emit('end-call', {
        callId: callData.callId,
        endedBy: user.id
      });
    }

    setIncomingCall(null);
    setOutgoingCall(null);
    stopRingtone();
    console.log('📴 Call ended');
  };

  const addNotification = (notification) => {
    setNotifications(prev => [
      { id: Date.now(), ...notification },
      ...prev.slice(0, 49) // Keep only last 50 notifications
    ]);
  };

  const removeNotification = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const addToCallHistory = (callData) => {
    setCallHistory(prev => [
      callData,
      ...prev.slice(0, 99) // Keep only last 100 calls
    ]);
  };

  const generateCallId = () => {
    return `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  };

  // Ringtone management
  let ringtoneAudio = null;

  const playRingtone = () => {
    try {
      ringtoneAudio = new Audio('/ringtone.mp3');
      ringtoneAudio.loop = true;
      ringtoneAudio.play().catch(e => console.log('Could not play ringtone:', e));
    } catch (error) {
      console.log('Ringtone not available:', error);
    }
  };

  const stopRingtone = () => {
    if (ringtoneAudio) {
      ringtoneAudio.pause();
      ringtoneAudio.currentTime = 0;
      ringtoneAudio = null;
    }
  };

  // Request notification permission on mount
  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  const value = {
    incomingCall,
    outgoingCall,
    callHistory,
    notifications,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall,
    removeNotification
  };

  return (
    <CallNotificationContext.Provider value={value}>
      {children}
    </CallNotificationContext.Provider>
  );
};

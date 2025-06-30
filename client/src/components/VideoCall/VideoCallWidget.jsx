import React, { useState, useEffect } from 'react';
import { useVideoCall } from './VideoCallContext';
import UserList from '../Call/UserList';
import IncomingCallModal from '../Call/IncomingCallModal';
import VideoCallModal from './VideoCallModal';
import './VideoCallWidget.css';

const VideoCallWidget = ({ 
  targetUsers = [],
  onCallStart = () => {},
  onCallEnd = () => {},
  position = 'bottom-right',
  theme = 'default',
  showUserList = true,
  autoHide = true
}) => {
  const { 
    isConnected, 
    onlineUsers, 
    incomingCall, 
    activeCall,
    initiateCall,
    acceptCall,
    rejectCall,
    endCall
  } = useVideoCall();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [callModalOpen, setCallModalOpen] = useState(false);

  // Auto-hide when not in use
  useEffect(() => {
    if (autoHide && !incomingCall && !activeCall && !isOpen) {
      const timer = setTimeout(() => {
        setIsMinimized(true);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [autoHide, incomingCall, activeCall, isOpen]);

  // Handle incoming call
  useEffect(() => {
    if (incomingCall) {
      setIsMinimized(false);
      setIsOpen(true);
    }
  }, [incomingCall]);

  // Handle active call
  useEffect(() => {
    if (activeCall) {
      setCallModalOpen(true);
      onCallStart(activeCall);
    } else {
      setCallModalOpen(false);
      if (activeCall === null) { // Call ended
        onCallEnd();
      }
    }
  }, [activeCall, onCallStart, onCallEnd]);

  const handleUserCall = async (user) => {
    const callData = await initiateCall(user);
    if (callData) {
      console.log('Call initiated:', callData);
    }
  };

  const handleAcceptCall = () => {
    acceptCall();
  };

  const handleRejectCall = () => {
    rejectCall();
  };

  const handleEndCall = () => {
    endCall();
  };

  const availableUsers = showUserList ? 
    (targetUsers.length > 0 ? targetUsers : onlineUsers) : 
    targetUsers;

  const widgetClasses = [
    'video-call-widget',
    `position-${position}`,
    `theme-${theme}`,
    isMinimized ? 'minimized' : '',
    isOpen ? 'open' : ''
  ].filter(Boolean).join(' ');

  if (!isConnected) {
    return (
      <div className={`${widgetClasses} disconnected`}>
        <div className="connection-status">
          <span>🔴 Video call không khả dụng</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className={widgetClasses}>
        {/* Minimized state - just a floating button */}
        {isMinimized && (
          <button 
            className="widget-toggle minimized-toggle"
            onClick={() => setIsMinimized(false)}
            title="Mở video call"
          >
            📞
            {onlineUsers.length > 0 && (
              <span className="online-indicator">{onlineUsers.length}</span>
            )}
          </button>
        )}

        {/* Expanded state */}
        {!isMinimized && (
          <>
            {/* Header */}
            <div className="widget-header">
              <div className="widget-title">
                <span className="status-indicator">
                  {isConnected ? '🟢' : '🔴'}
                </span>
                Video Call
                {onlineUsers.length > 0 && (
                  <span className="online-count">({onlineUsers.length} online)</span>
                )}
              </div>
              <div className="widget-controls">
                <button 
                  className="widget-control"
                  onClick={() => setIsOpen(!isOpen)}
                  title={isOpen ? "Thu gọn" : "Mở rộng"}
                >
                  {isOpen ? '▼' : '▶'}
                </button>
                <button 
                  className="widget-control"
                  onClick={() => setIsMinimized(true)}
                  title="Thu nhỏ"
                >
                  ─
                </button>
              </div>
            </div>

            {/* Content */}
            {isOpen && (
              <div className="widget-content">
                {showUserList && (
                  <UserList 
                    users={availableUsers}
                    onUserCall={handleUserCall}
                    currentUserId={useVideoCall().currentUser?.id}
                  />
                )}

                {!showUserList && availableUsers.length === 0 && (
                  <div className="no-users">
                    <p>Không có người dùng online</p>
                  </div>
                )}

                {/* Quick actions */}
                <div className="widget-actions">
                  <button 
                    className="action-btn refresh"
                    onClick={() => window.location.reload()}
                    title="Refresh kết nối"
                  >
                    🔄 Refresh
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Incoming call modal */}
      {incomingCall && (
        <IncomingCallModal 
          caller={incomingCall.caller}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
          isOpen={true}
        />
      )}

      {/* Video call modal */}
      {callModalOpen && activeCall && (
        <VideoCallModal
          isOpen={callModalOpen}
          roomId={activeCall.roomId}
          partner={activeCall.partner}
          onEndCall={handleEndCall}
          onClose={() => setCallModalOpen(false)}
        />
      )}
    </>
  );
};

export default VideoCallWidget;

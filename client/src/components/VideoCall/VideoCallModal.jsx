import React, { useState, useEffect } from 'react';
import { CallProvider } from '../../contexts/CallContext';
import VideoCall from '../VideoCall/VideoCall';
import { useVideoCall } from './VideoCallContext';
import './VideoCallModal.css';

const VideoCallModal = ({ 
  isOpen, 
  roomId, 
  partner, 
  onEndCall, 
  onClose,
  showTranslation = true 
}) => {
  const { socket, currentUser } = useVideoCall();
  const [isModalOpen, setIsModalOpen] = useState(isOpen);

  useEffect(() => {
    setIsModalOpen(isOpen);
  }, [isOpen]);

  const handleEndCall = () => {
    onEndCall();
    setIsModalOpen(false);
    onClose();
  };

  const handleClose = () => {
    setIsModalOpen(false);
    onClose();
  };

  if (!isModalOpen) return null;

  return (
    <div className="video-call-modal-overlay" onClick={handleClose}>
      <div className="video-call-modal" onClick={(e) => e.stopPropagation()}>
        <div className="video-call-modal-header">
          <div className="call-info">
            <img 
              src={partner?.avatar || '/default-avatar.png'} 
              alt={partner?.username}
              className="partner-avatar"
            />
            <div className="partner-info">
              <h3>{partner?.username}</h3>
              <span className="call-status">Connected</span>
            </div>
          </div>
          <div className="modal-controls">
            <button 
              className="modal-control minimize"
              onClick={() => setIsModalOpen(false)}
              title="Minimize"
            >
              ─
            </button>
            <button 
              className="modal-control close"
              onClick={handleClose}
              title="Close"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="video-call-modal-content">
          <CallProvider socket={socket} user={currentUser}>
            <VideoCall 
              roomId={roomId}
              autoJoin={true}
              showControls={true}
              showTranslation={showTranslation}
              onCallEnd={handleEndCall}
              partner={partner}
            />
          </CallProvider>
        </div>
      </div>
    </div>
  );
};

export default VideoCallModal;

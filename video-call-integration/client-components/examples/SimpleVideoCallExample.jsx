import React, { useState } from 'react';
import VideoCallComponent from './components/VideoCallComponent';
import { useSocket } from './hooks/useSocket';
import { useWebRTC } from './hooks/useWebRTC';

/**
 * Example: Sử dụng riêng lẻ VideoCallComponent
 */
const SimpleVideoCallExample = () => {
  const [roomId, setRoomId] = useState('');
  const [isInCall, setIsInCall] = useState(false);
  
  const socket = useSocket('https://34.142.175.163/video-call-socket.io');
  const webRTC = useWebRTC(roomId);

  const handleJoinCall = () => {
    if (roomId.trim()) {
      setIsInCall(true);
      webRTC.joinRoom(roomId);
    }
  };

  const handleLeaveCall = () => {
    setIsInCall(false);
    webRTC.leaveRoom();
    setRoomId('');
  };

  return (
    <div className="simple-video-call">
      <h2>Simple Video Call Example</h2>
      
      {!isInCall ? (
        <div className="join-form">
          <input
            type="text"
            placeholder="Enter room ID"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
          />
          <button onClick={handleJoinCall} disabled={!roomId.trim()}>
            Join Call
          </button>
        </div>
      ) : (
        <div className="video-call-container">
          <VideoCallComponent
            roomId={roomId}
            userId="user-123"
            userName="John Doe"
            onLeave={handleLeaveCall}
          />
        </div>
      )}
    </div>
  );
};

export default SimpleVideoCallExample;

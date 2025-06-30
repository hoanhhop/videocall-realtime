import React, { useEffect, useRef } from 'react';
import { useCall } from '../../contexts/CallContext';
import { useTranslation } from '../../contexts/TranslationContext';
import VideoControls from './VideoControls';
import SubtitleDisplay from '../Subtitle/SubtitleDisplay';
import RoomInput from './RoomInput';
import RoomInfo from './RoomInfo';
import './VideoCall.css';

const VideoCall = () => {
  const { 
    localStream, 
    remoteStream, 
    isCallActive, 
    startCall, 
    endCall, 
    toggleMic, 
    toggleVideo,
    isMicMuted,
    isVideoOff,
    roomId,
    joinRoom
  } = useCall();
  
  const {
    recognizedText,
    translatedText,
    isRecognizing,
    startRecognition,
    stopRecognition,
    enableSubtitles
  } = useTranslation();
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  
  // Set up local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);
  
  // Set up remote video stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);
  
  // Start/stop speech recognition when call status changes
  useEffect(() => {
    if (isCallActive && !isRecognizing) {
      startRecognition();
    } else if (!isCallActive && isRecognizing) {
      stopRecognition();
    }
  }, [isCallActive, isRecognizing]);
  
  // Call control handlers
  const handleStartCall = () => {
    startCall();
  };

  const handleJoinRoom = (roomIdToJoin) => {
    joinRoom(roomIdToJoin);
  };

  const handleEndCall = () => {
    endCall();
    stopRecognition();
  };

  // Nếu chưa trong cuộc gọi, hiển thị giao diện nhập room
  if (!isCallActive) {
    return (
      <div className="video-call-container">
        <RoomInput 
          onStartCall={handleStartCall}
          onJoinRoom={handleJoinRoom}
          isCallActive={isCallActive}
        />
      </div>
    );
  }
  
  return (
    <div className="video-call-container">
      <div className="video-grid">
        <div className="video-wrapper local-video">
          <video 
            ref={localVideoRef} 
            autoPlay 
            muted 
            playsInline
            className={isVideoOff ? 'video-off' : ''}
          />
          
          {/* Phụ đề overlay trên video */}
          {enableSubtitles && recognizedText && (
            <div className="subtitle-overlay bottom-left">
              <SubtitleDisplay 
                text={recognizedText} 
                isLocal={true}
              />
            </div>
          )}
          
          <div className="video-label">Bạn</div>
        </div>
        
        <div className="video-wrapper remote-video">
          <video 
            ref={remoteVideoRef} 
            autoPlay 
            playsInline
          />
          
          {/* Phụ đề overlay trên video */}
          {enableSubtitles && translatedText && (
            <div className="subtitle-overlay bottom-right">
              <SubtitleDisplay 
                text={translatedText} 
                isLocal={false}
              />
            </div>
          )}
          
          {!remoteStream && (
            <RoomInfo roomId={roomId} />
          )}
          
          {remoteStream && <div className="video-label">Người khác</div>}
        </div>
      </div>
      
      <VideoControls 
        onEndCall={handleEndCall}
        onToggleMic={toggleMic}
        onToggleVideo={toggleVideo}
        isMicMuted={isMicMuted}
        isVideoOff={isVideoOff}
        isRecognizing={isRecognizing}
        onStartRecognition={startRecognition}
        onStopRecognition={stopRecognition}
      />
    </div>
  );
};

export default VideoCall;
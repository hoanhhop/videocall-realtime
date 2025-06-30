import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useWebRTC } from '../hooks/useWebRTC';
import { videoCallAPI } from '../utils/api';
import { formatDuration, handleError, createNotification } from '../utils/helpers';

/**
 * Main Video Call Component
 * @param {Object} props - Component props
 * @param {Object} props.user - Current user object
 * @param {string} props.token - JWT token
 * @param {string} props.sessionId - Video call session ID (optional)
 * @param {Function} props.onError - Error callback
 * @param {Function} props.onCallEnd - Call end callback
 * @param {string} props.className - CSS class name
 */
const VideoCallComponent = ({
  user,
  token,
  sessionId = null,
  onError,
  onCallEnd,
  className = 'video-call'
}) => {
  // Socket connection
  const { socket, isConnected, error: socketError } = useSocket('https://34.142.175.163:3001', token);

  // WebRTC hook
  const {
    localStream,
    remoteStream,
    isVideoEnabled,
    isAudioEnabled,
    connectionState,
    isScreenSharing,
    localVideoRef,
    remoteVideoRef,
    initializeMedia,
    createOffer,
    createAnswer,
    handleAnswer,
    handleIceCandidate,
    toggleVideo,
    toggleAudio,
    startScreenShare,
    stopScreenShare,
    cleanup
  } = useWebRTC(socket);

  // Component state
  const [callState, setCallState] = useState('idle'); // idle, calling, connected, ended
  const [currentSession, setCurrentSession] = useState(null);
  const [callDuration, setCallDuration] = useState(0);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [participants, setParticipants] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);

  // Refs
  const callTimerRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Khởi tạo media khi component mount
  useEffect(() => {
    if (socket && isConnected) {
      initializeMediaDevices();
    }
  }, [socket, isConnected]);

  // Nếu có sessionId, tự động join call
  useEffect(() => {
    if (sessionId && socket && isConnected) {
      joinCall(sessionId);
    }
  }, [sessionId, socket, isConnected]);

  // Socket event listeners
  useEffect(() => {
    if (!socket) return;

    // Call events
    socket.on('call-offer', handleIncomingOffer);
    socket.on('call-answer', handleIncomingAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('call-ended', handleCallEnded);
    socket.on('user-joined', handleUserJoined);
    socket.on('user-left', handleUserLeft);
    socket.on('chat-message', handleChatMessage);
    socket.on('translation-result', handleTranslationResult);

    return () => {
      socket.off('call-offer');
      socket.off('call-answer');
      socket.off('ice-candidate');
      socket.off('call-ended');
      socket.off('user-joined');
      socket.off('user-left');
      socket.off('chat-message');
      socket.off('translation-result');
    };
  }, [socket]);

  // Call timer
  useEffect(() => {
    if (callState === 'connected') {
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
        callTimerRef.current = null;
      }
    }

    return () => {
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, [callState]);

  // Auto scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

  /**
   * Khởi tạo media devices
   */
  const initializeMediaDevices = async () => {
    try {
      setIsLoading(true);
      await initializeMedia();
    } catch (error) {
      const errorMsg = handleError(error);
      if (onError) onError(error);
      console.error('Failed to initialize media:', errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Bắt đầu cuộc gọi mới
   */
  const startCall = async (targetUserId = null) => {
    if (!socket || !localStream) return;

    try {
      setIsLoading(true);
      setCallState('calling');

      // Tạo session mới
      const sessionResponse = await videoCallAPI.createVideoCall({
        participantId: targetUserId,
        type: 'video',
        language: 'vi'
      });

      if (sessionResponse.success) {
        setCurrentSession(sessionResponse.session);
        
        // Join room
        socket.emit('join-room', sessionResponse.session.sessionId);
        
        // Tạo offer
        await createOffer(localStream);

        // Notification
        await createNotification('Video Call', 'Đang kết nối cuộc gọi...');
      }
    } catch (error) {
      const errorMsg = handleError(error);
      if (onError) onError(error);
      setCallState('idle');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Tham gia cuộc gọi có sẵn
   */
  const joinCall = async (sessionId) => {
    if (!socket || !localStream) return;

    try {
      setIsLoading(true);
      setCallState('calling');

      // Join session
      const joinResponse = await videoCallAPI.joinVideoCall(sessionId);

      if (joinResponse.success) {
        setCurrentSession(joinResponse.session);
        
        // Join room
        socket.emit('join-room', sessionId);
        
        setCallState('connected');
        setCallDuration(0);
      }
    } catch (error) {
      const errorMsg = handleError(error);
      if (onError) onError(error);
      setCallState('idle');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Kết thúc cuộc gọi
   */
  const endCall = async () => {
    try {
      if (currentSession) {
        await videoCallAPI.endVideoCall(currentSession.sessionId);
        socket.emit('end-call', currentSession.sessionId);
      }

      // Cleanup
      cleanup();
      setCallState('ended');
      setCallDuration(0);
      setCurrentSession(null);
      setMessages([]);
      setParticipants([]);

      if (onCallEnd) {
        onCallEnd();
      }

      // Notification
      await createNotification('Video Call', 'Cuộc gọi đã kết thúc');

      // Reset state sau 3 giây
      setTimeout(() => {
        setCallState('idle');
      }, 3000);
    } catch (error) {
      console.error('Error ending call:', error);
    }
  };

  /**
   * Xử lý incoming offer
   */
  const handleIncomingOffer = async (data) => {
    const { offer, from, sessionData } = data;
    
    setIncomingCall({
      offer,
      from,
      sessionData
    });

    // Notification
    await createNotification(
      'Cuộc gọi đến', 
      `${from.tenTK || from.email} đang gọi cho bạn`
    );
  };

  /**
   * Chấp nhận cuộc gọi đến
   */
  const acceptIncomingCall = async () => {
    if (!incomingCall || !localStream) return;

    try {
      setCallState('connected');
      setCurrentSession(incomingCall.sessionData);
      
      // Join room
      socket.emit('join-room', incomingCall.sessionData.sessionId);
      
      // Create answer
      await createAnswer(incomingCall.offer, localStream);
      
      setIncomingCall(null);
      setCallDuration(0);
    } catch (error) {
      const errorMsg = handleError(error);
      if (onError) onError(error);
    }
  };

  /**
   * Từ chối cuộc gọi đến
   */
  const rejectIncomingCall = () => {
    if (incomingCall) {
      socket.emit('call-rejected', {
        sessionId: incomingCall.sessionData.sessionId,
        to: incomingCall.from.Id
      });
      setIncomingCall(null);
    }
  };

  /**
   * Xử lý incoming answer
   */
  const handleIncomingAnswer = async (data) => {
    const { answer } = data;
    await handleAnswer(answer);
    setCallState('connected');
    setCallDuration(0);
  };

  /**
   * Xử lý call ended
   */
  const handleCallEnded = () => {
    endCall();
  };

  /**
   * Xử lý user joined
   */
  const handleUserJoined = (data) => {
    setParticipants(prev => [...prev, data.user]);
  };

  /**
   * Xử lý user left
   */
  const handleUserLeft = (data) => {
    setParticipants(prev => prev.filter(p => p.Id !== data.userId));
  };

  /**
   * Gửi chat message
   */
  const sendMessage = () => {
    if (!newMessage.trim() || !socket || !currentSession) return;

    const message = {
      sessionId: currentSession.sessionId,
      message: newMessage.trim(),
      timestamp: new Date().toISOString()
    };

    socket.emit('chat-message', message);
    setNewMessage('');
  };

  /**
   * Xử lý chat message
   */
  const handleChatMessage = (data) => {
    setMessages(prev => [...prev, data]);
  };

  /**
   * Xử lý translation result
   */
  const handleTranslationResult = (data) => {
    // Hiển thị kết quả dịch
    setMessages(prev => [...prev, {
      ...data,
      type: 'translation'
    }]);
  };

  /**
   * Xử lý key press trong chat
   */
  const handleChatKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Render incoming call modal
  if (incomingCall) {
    return (
      <div className={`${className} ${className}--incoming-call`}>
        <div className={`${className}__incoming-modal`}>
          <div className={`${className}__incoming-content`}>
            <h3>Cuộc gọi đến</h3>
            <p>{incomingCall.from.tenTK || incomingCall.from.email} đang gọi cho bạn</p>
            <div className={`${className}__incoming-actions`}>
              <button
                onClick={acceptIncomingCall}
                className={`${className}__btn ${className}__btn--accept`}
              >
                Chấp nhận
              </button>
              <button
                onClick={rejectIncomingCall}
                className={`${className}__btn ${className}__btn--reject`}
              >
                Từ chối
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`${className} ${className}--${callState}`}>
      {/* Header với thông tin cuộc gọi */}
      <div className={`${className}__header`}>
        <div className={`${className}__call-info`}>
          {callState === 'connected' && (
            <div className={`${className}__duration`}>
              {formatDuration(callDuration)}
            </div>
          )}
          <div className={`${className}__status`}>
            {callState === 'idle' && 'Sẵn sàng'}
            {callState === 'calling' && 'Đang kết nối...'}
            {callState === 'connected' && 'Đang trong cuộc gọi'}
            {callState === 'ended' && 'Cuộc gọi đã kết thúc'}
          </div>
        </div>

        <div className={`${className}__connection-status`}>
          <span className={`${className}__connection-indicator ${isConnected ? 'connected' : 'disconnected'}`}>
            {isConnected ? 'Đã kết nối' : 'Mất kết nối'}
          </span>
        </div>
      </div>

      {/* Video container */}
      <div className={`${className}__video-container`}>
        {/* Remote video */}
        <div className={`${className}__remote-video`}>
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className={`${className}__video ${className}__video--remote`}
          />
          {!remoteStream && callState === 'connected' && (
            <div className={`${className}__no-video`}>
              Đang chờ video từ người khác...
            </div>
          )}
        </div>

        {/* Local video */}
        <div className={`${className}__local-video`}>
          <video
            ref={localVideoRef}
            autoPlay
            playsInline
            muted
            className={`${className}__video ${className}__video--local`}
          />
        </div>
      </div>

      {/* Controls */}
      <div className={`${className}__controls`}>
        <button
          onClick={toggleVideo}
          disabled={!localStream}
          className={`${className}__btn ${className}__btn--video ${!isVideoEnabled ? `${className}__btn--disabled` : ''}`}
          title={isVideoEnabled ? 'Tắt camera' : 'Bật camera'}
        >
          📹 {isVideoEnabled ? 'Video On' : 'Video Off'}
        </button>

        <button
          onClick={toggleAudio}
          disabled={!localStream}
          className={`${className}__btn ${className}__btn--audio ${!isAudioEnabled ? `${className}__btn--disabled` : ''}`}
          title={isAudioEnabled ? 'Tắt mic' : 'Bật mic'}
        >
          🎤 {isAudioEnabled ? 'Mic On' : 'Mic Off'}
        </button>

        <button
          onClick={isScreenSharing ? stopScreenShare : startScreenShare}
          disabled={!localStream || callState !== 'connected'}
          className={`${className}__btn ${className}__btn--screen ${isScreenSharing ? `${className}__btn--active` : ''}`}
          title={isScreenSharing ? 'Dừng chia sẻ màn hình' : 'Chia sẻ màn hình'}
        >
          🖥️ {isScreenSharing ? 'Stop Share' : 'Share Screen'}
        </button>

        {callState === 'idle' && (
          <button
            onClick={() => startCall()}
            disabled={isLoading || !localStream}
            className={`${className}__btn ${className}__btn--start`}
          >
            {isLoading ? 'Đang khởi tạo...' : 'Bắt đầu cuộc gọi'}
          </button>
        )}

        {(callState === 'calling' || callState === 'connected') && (
          <button
            onClick={endCall}
            className={`${className}__btn ${className}__btn--end`}
          >
            Kết thúc cuộc gọi
          </button>
        )}
      </div>

      {/* Chat panel */}
      {callState === 'connected' && (
        <div className={`${className}__chat`}>
          <div className={`${className}__chat-header`}>
            <h4>Chat & Dịch thuật</h4>
          </div>
          
          <div 
            ref={chatContainerRef}
            className={`${className}__chat-messages`}
          >
            {messages.map((msg, index) => (
              <div 
                key={index} 
                className={`${className}__message ${msg.type === 'translation' ? `${className}__message--translation` : ''}`}
              >
                <div className={`${className}__message-header`}>
                  <span className={`${className}__message-sender`}>
                    {msg.senderName || 'Unknown'}
                  </span>
                  <span className={`${className}__message-time`}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className={`${className}__message-content`}>
                  {msg.message}
                  {msg.translatedText && (
                    <div className={`${className}__translation`}>
                      <small>Dịch: {msg.translatedText}</small>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className={`${className}__chat-input`}>
            <input
              type=\"text\"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleChatKeyPress}
              placeholder=\"Nhập tin nhắn...\"
              className={`${className}__input`}
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim()}
              className={`${className}__btn ${className}__btn--send`}
            >
              Gửi
            </button>
          </div>
        </div>
      )}

      {/* Error display */}
      {socketError && (
        <div className={`${className}__error`}>
          {socketError}
        </div>
      )}
    </div>
  );
};

export default VideoCallComponent;

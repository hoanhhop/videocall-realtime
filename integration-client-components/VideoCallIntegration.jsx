import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, 
  PhoneOff, 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  MessageSquare,
  Users,
  Settings,
  Globe
} from 'lucide-react';

const VideoCallIntegration = ({ 
  appointmentId,
  userToken,
  onCallEnd,
  serverUrl = 'https://34.142.175.163',
  className = ''
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [participants, setParticipants] = useState([]);
  const [translationEnabled, setTranslationEnabled] = useState(true);
  const [messages, setMessages] = useState([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [error, setError] = useState(null);
  const [callStatus, setCallStatus] = useState('idle'); // idle, connecting, connected, ended
  
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const socketRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!userToken || !appointmentId) {
      setError('Token hoặc ID cuộc hẹn không hợp lệ');
      return;
    }

    initializeWebSocket();
    
    return () => {
      cleanup();
    };
  }, [userToken, appointmentId]);

  const initializeWebSocket = () => {
    try {
      const wsUrl = `${serverUrl.replace('http', 'ws')}/ws/video-call/${appointmentId}?token=${userToken}`;
      socketRef.current = new WebSocket(wsUrl);

      socketRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setError(null);
      };

      socketRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      };

      socketRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
      };

      socketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setError('Không thể kết nối đến server');
        setIsConnected(false);
      };
    } catch (error) {
      console.error('Failed to initialize WebSocket:', error);
      setError('Lỗi khởi tạo kết nối');
    }
  };

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'participants_update':
        setParticipants(data.participants);
        break;
      case 'translation':
        addTranslationMessage(data.originalText, data.translatedText, data.fromLanguage, data.toLanguage);
        break;
      case 'call_status':
        setCallStatus(data.status);
        break;
      case 'offer':
        handleOffer(data.offer, data.from);
        break;
      case 'answer':
        handleAnswer(data.answer);
        break;
      case 'ice_candidate':
        handleIceCandidate(data.candidate);
        break;
      case 'call_ended':
        handleCallEnded();
        break;
      case 'error':
        setError(data.message);
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  };

  const addTranslationMessage = (original, translated, fromLang, toLang) => {
    const message = {
      id: Date.now(),
      type: 'translation',
      originalText: original,
      translatedText: translated,
      fromLanguage: fromLang,
      toLanguage: toLang,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, message]);
  };

  const startCall = async () => {
    try {
      setCallStatus('connecting');
      setError(null);

      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({
        video: isVideoOn,
        audio: true
      });

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Initialize peer connection
      initializePeerConnection();

      // Add stream to peer connection
      stream.getTracks().forEach(track => {
        peerConnectionRef.current.addTrack(track, stream);
      });

      // Send call start signal
      sendWebSocketMessage({
        type: 'start_call',
        appointmentId,
        mediaConstraints: {
          video: isVideoOn,
          audio: true
        }
      });

      setIsCallActive(true);
      setCallStatus('connected');
    } catch (error) {
      console.error('Error starting call:', error);
      setError('Không thể bắt đầu cuộc gọi. Vui lòng kiểm tra quyền truy cập camera/microphone.');
      setCallStatus('idle');
    }
  };

  const endCall = () => {
    setCallStatus('ended');
    setIsCallActive(false);
    
    sendWebSocketMessage({
      type: 'end_call',
      appointmentId
    });

    cleanup();
    
    if (onCallEnd) {
      onCallEnd();
    }
  };
  const initializePeerConnection = () => {
    const config = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:global.stun.twilio.com:3478' },
        // TURN servers for NAT traversal - required for cross-network calls
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
        }
      ],
      iceCandidatePoolSize: 10
    };

    peerConnectionRef.current = new RTCPeerConnection(config);

    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        sendWebSocketMessage({
          type: 'ice_candidate',
          candidate: event.candidate,
          appointmentId
        });
      }
    };

    peerConnectionRef.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };
  };

  const handleOffer = async (offer, from) => {
    if (!peerConnectionRef.current) {
      initializePeerConnection();
    }

    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnectionRef.current.createAnswer();
    await peerConnectionRef.current.setLocalDescription(answer);

    sendWebSocketMessage({
      type: 'answer',
      answer,
      to: from,
      appointmentId
    });
  };

  const handleAnswer = async (answer) => {
    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer));
  };

  const handleIceCandidate = async (candidate) => {
    await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
  };

  const handleCallEnded = () => {
    setIsCallActive(false);
    setCallStatus('ended');
    cleanup();
    
    if (onCallEnd) {
      onCallEnd();
    }
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isMuted;
        setIsMuted(!isMuted);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !isVideoOn;
        setIsVideoOn(!isVideoOn);
      }
    }
  };

  const toggleTranslation = () => {
    setTranslationEnabled(!translationEnabled);
    sendWebSocketMessage({
      type: 'toggle_translation',
      enabled: !translationEnabled,
      appointmentId
    });
  };

  const sendWebSocketMessage = (message) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message));
    }
  };

  const cleanup = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }
    if (socketRef.current) {
      socketRef.current.close();
    }
  };

  const sendMessage = () => {
    if (currentMessage.trim()) {
      const message = {
        id: Date.now(),
        type: 'chat',
        text: currentMessage,
        timestamp: new Date(),
        sender: 'me'
      };
      
      setMessages(prev => [...prev, message]);
      sendWebSocketMessage({
        type: 'chat_message',
        message: currentMessage,
        appointmentId
      });
      
      setCurrentMessage('');
    }
  };

  return (
    <div className={`video-call-integration ${className}`}>
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Video Call với dịch thuật</h3>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}></div>
              <span className="text-sm">{isConnected ? 'Đã kết nối' : 'Mất kết nối'}</span>
            </div>
          </div>
          {error && (
            <div className="mt-2 p-2 bg-red-500 rounded text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Video Area */}
        <div className="relative bg-gray-900 aspect-video">
          {/* Remote Video */}
          <video
            ref={remoteVideoRef}
            className="w-full h-full object-cover"
            autoPlay
            playsInline
          />
          
          {/* Local Video */}
          <div className="absolute bottom-4 right-4 w-32 h-24 bg-gray-800 rounded-lg overflow-hidden">
            <video
              ref={localVideoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />
          </div>

          {/* Call Status Overlay */}
          {callStatus === 'connecting' && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
              <div className="text-white text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                <p>Đang kết nối...</p>
              </div>
            </div>
          )}

          {/* Translation Status */}
          {translationEnabled && isCallActive && (
            <div className="absolute top-4 left-4 bg-green-600 text-white px-3 py-1 rounded-full text-sm flex items-center">
              <Globe className="w-4 h-4 mr-1" />
              Dịch thuật: Bật
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 bg-gray-50">
          <div className="flex justify-center space-x-4 mb-4">
            {!isCallActive ? (
              <button
                onClick={startCall}
                disabled={!isConnected || callStatus === 'connecting'}
                className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white p-3 rounded-full transition-colors"
              >
                <Phone className="w-6 h-6" />
              </button>
            ) : (
              <>
                <button
                  onClick={toggleMute}
                  className={`p-3 rounded-full transition-colors ${
                    isMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
                  } text-white`}
                >
                  {isMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>

                <button
                  onClick={toggleVideo}
                  className={`p-3 rounded-full transition-colors ${
                    !isVideoOn ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-700'
                  } text-white`}
                >
                  {isVideoOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                </button>

                <button
                  onClick={toggleTranslation}
                  className={`p-3 rounded-full transition-colors ${
                    translationEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-600 hover:bg-gray-700'
                  } text-white`}
                >
                  <Globe className="w-6 h-6" />
                </button>

                <button
                  onClick={endCall}
                  className="bg-red-600 hover:bg-red-700 text-white p-3 rounded-full transition-colors"
                >
                  <PhoneOff className="w-6 h-6" />
                </button>
              </>
            )}
          </div>

          {/* Participants */}
          {participants.length > 0 && (
            <div className="mb-4">
              <div className="flex items-center text-sm text-gray-600 mb-2">
                <Users className="w-4 h-4 mr-1" />
                Người tham gia ({participants.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {participants.map((participant, index) => (
                  <span key={index} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-xs">
                    {participant.tenTK}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Chat/Translation Messages */}
        <div className="border-t bg-white">
          <div className="h-64 overflow-y-auto p-4 space-y-2">
            {messages.map((message) => (
              <div key={message.id} className="message">
                {message.type === 'translation' ? (
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-3 rounded">
                    <div className="text-sm text-gray-600">
                      {message.fromLanguage} → {message.toLanguage}
                    </div>
                    <div className="text-gray-800">{message.originalText}</div>
                    <div className="text-blue-800 font-medium">{message.translatedText}</div>
                  </div>
                ) : (
                  <div className={`flex ${message.sender === 'me' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs px-3 py-2 rounded-lg ${
                      message.sender === 'me' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-200 text-gray-800'
                    }`}>
                      {message.text}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Message Input */}
          <div className="p-4 border-t">
            <div className="flex space-x-2">
              <input
                type="text"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Nhập tin nhắn..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={sendMessage}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoCallIntegration;

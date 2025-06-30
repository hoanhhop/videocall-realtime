import React, { useState } from 'react';
import './RoomInput.css';

const RoomInput = ({ onStartCall, onJoinRoom, isCallActive }) => {
  const [roomId, setRoomId] = useState('');
  const [showJoinForm, setShowJoinForm] = useState(false);

  const handleStartNewCall = () => {
    onStartCall();
  };
  const handleJoinCall = () => {
    if (roomId.trim()) {
      onJoinRoom(roomId.trim().toLowerCase());
    }
  };
  const handleRoomIdChange = (e) => {
    setRoomId(e.target.value.toLowerCase());
  };

  if (isCallActive) {
    return null; // Ẩn component khi đã trong cuộc gọi
  }

  return (
    <div className="room-input-container">
      <div className="room-input-card">
        <h3>Video Call với Dịch Thuật Thời Gian Thực</h3>
        
        <div className="call-options">
          {!showJoinForm ? (
            <>
              <button 
                className="primary-btn start-new-call-btn"
                onClick={handleStartNewCall}
              >
                🎥 Bắt Đầu Cuộc Gọi Mới
              </button>
              
              <div className="divider">
                <span>hoặc</span>
              </div>
              
              <button 
                className="secondary-btn join-existing-btn"
                onClick={() => setShowJoinForm(true)}
              >
                🔗 Tham Gia Phòng Có Sẵn
              </button>
            </>
          ) : (
            <div className="join-form">
              <h4>Nhập Room ID để tham gia</h4>
              <div className="input-group">
                <input
                  type="text"
                  value={roomId}
                  onChange={handleRoomIdChange}
                  placeholder="Nhập Room ID (vd: abc12)"
                  className="room-id-input"
                  maxLength={5}
                />
                <button
                  className="primary-btn join-btn"
                  onClick={handleJoinCall}
                  disabled={!roomId.trim()}
                >
                  Tham Gia
                </button>
              </div>
              <button
                className="text-btn back-btn"
                onClick={() => setShowJoinForm(false)}
              >
                ← Quay lại
              </button>
            </div>
          )}
        </div>

        <div className="features-preview">
          <h4>Tính năng:</h4>
          <ul>
            <li>🎤 Nhận diện giọng nói thời gian thực</li>
            <li>🌐 Dịch thuật tức thì Việt ┄ English</li>
            <li>📝 Phụ đề trực tiếp trên video</li>
            <li>🔊 Text-to-Speech (TTS)</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default RoomInput;

import React, { useState, useEffect } from 'react';
import './RoomInfo.css';

const RoomInfo = ({ roomId }) => {
  const [copied, setCopied] = useState(false);
  const [showModal, setShowModal] = useState(true); // Mặc định hiển thị modal khi tạo room
  const [hasBeenClosed, setHasBeenClosed] = useState(false);

  const handleCopyRoomId = async () => {
    try {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy room ID:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = roomId;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShowModal = () => {
    setShowModal(true);
  };
  const handleCloseModal = () => {
    setShowModal(false);
    setHasBeenClosed(true);
  };

  return (
    <>
      {/* Compact button - only show after modal has been closed */}
      {hasBeenClosed && !showModal && (
        <div className="room-info-compact">
          <button 
            className="compact-room-info-btn"
            onClick={handleShowModal}
            title="Xem thông tin phòng"
          >
            📋 Room Info
          </button>
        </div>
      )}

      {/* Placeholder content when modal never opened */}
      {!hasBeenClosed && !showModal && (
        <div className="room-info-placeholder">
          <div className="placeholder-content">
            <div className="waiting-icon">👥</div>
            <p>Đang chờ người tham gia...</p>
            <small>Room ID: {roomId}</small>
          </div>
        </div>
      )}

      {/* Modal Overlay - Render to document body */}
      {showModal && (
        <div 
          className="room-info-modal-overlay" 
          onClick={handleCloseModal}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 10000
          }}
        >
          <div className="room-info-modal" onClick={(e) => e.stopPropagation()}>
            <button 
              className="close-modal-btn"
              onClick={handleCloseModal}
              title="Đóng"
            >
              ✕
            </button>
            
            <div className="room-info-content">
              <h3>🎥 Thông tin phòng Video Call</h3>
              <p className="modal-subtitle">Chia sẻ thông tin này để mời người khác tham gia</p>
              
              <div className="room-id-section">
                <label className="room-id-label">🆔 Room ID của bạn:</label>
                <div className="room-id-container">
                  <div className="room-id-display">
                    <span className="room-id-text">{roomId}</span>
                    <button 
                      className={`copy-btn ${copied ? 'copied' : ''}`}
                      onClick={handleCopyRoomId}
                      title="Copy Room ID"
                    >
                      {copied ? '✅ Đã copy!' : '📋 Copy'}
                    </button>
                  </div>
                </div>
                <p className="room-id-hint">
                  💡 Chia sẻ Room ID này để mời người khác tham gia cuộc gọi
                </p>
              </div>

              <div className="connection-steps">
                <h4>📋 Hướng dẫn kết nối:</h4>
                <ol>
                  <li>📋 Sao chép Room ID ở trên</li>
                  <li>📤 Gửi Room ID cho người muốn tham gia</li>
                  <li>🔗 Người đó chọn "Tham Gia Phòng Có Sẵn" và nhập Room ID</li>
                  <li>🎉 Bắt đầu trò chuyện với dịch thuật tự động!</li>
                </ol>
              </div>

              <div className="modal-actions">
                <button 
                  className="close-modal-action-btn"
                  onClick={handleCloseModal}
                >
                  ✅ Đã hiểu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RoomInfo;

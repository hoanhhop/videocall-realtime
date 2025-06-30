// client/src/components/Call/IncomingCallModal.jsx
import React, { useEffect, useState } from 'react';
import { useCallNotification } from '../../contexts/CallNotificationContext';
import './IncomingCallModal.css';

const IncomingCallModal = () => {
  const { incomingCall, acceptCall, rejectCall } = useCallNotification();
  const [timeLeft, setTimeLeft] = useState(30); // 30 seconds to answer

  useEffect(() => {
    if (!incomingCall) {
      setTimeLeft(30);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Auto-reject if time runs out
          rejectCall();
          return 30;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [incomingCall, rejectCall]);

  if (!incomingCall) return null;

  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call-modal">
        <div className="call-animation">
          <div className="pulse-ring"></div>
          <div className="pulse-ring pulse-ring-delay-1"></div>
          <div className="pulse-ring pulse-ring-delay-2"></div>
          <div className="caller-avatar">
            <img 
              src={incomingCall.caller.avatar || '/default-avatar.png'} 
              alt={incomingCall.caller.username}
              onError={(e) => {
                e.target.src = '/default-avatar.png';
              }}
            />
          </div>
        </div>
        
        <div className="call-info">
          <h2>Incoming Call</h2>
          <p className="caller-name">{incomingCall.caller.username}</p>
          <p className="call-type">Video Call with Translation</p>
          
          <div className="time-remaining">
            <div className="timer-circle">
              <svg viewBox="0 0 36 36" className="circular-chart">
                <path
                  className="circle-bg"
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="circle"
                  strokeDasharray={`${(timeLeft / 30) * 100}, 100`}
                  d="M18 2.0845
                    a 15.9155 15.9155 0 0 1 0 31.831
                    a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="timer-text">{timeLeft}s</span>
            </div>
          </div>
        </div>
        
        <div className="call-actions">
          <button 
            className="reject-btn"
            onClick={rejectCall}
            title="Reject Call"
          >
            <span className="btn-icon">📞</span>
            <span className="btn-text">Decline</span>
          </button>
          
          <button 
            className="accept-btn"
            onClick={acceptCall}
            title="Accept Call"
          >
            <span className="btn-icon">📹</span>
            <span className="btn-text">Accept</span>
          </button>
        </div>
        
        <div className="call-details">
          <p>✨ Real-time translation available</p>
          <p>🌐 Language: {incomingCall.caller.language || 'Auto-detect'}</p>
        </div>
      </div>
    </div>
  );
};

export default IncomingCallModal;

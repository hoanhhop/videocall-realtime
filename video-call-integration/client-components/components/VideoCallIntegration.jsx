import React, { useState, useEffect } from 'react';
import AuthenticationComponent from './AuthenticationComponent';
import VideoCallComponent from './VideoCallComponent';
import AppointmentManager from './AppointmentManager';
import { checkWebRTCSupport, handleError, createNotification } from '../utils/helpers';

/**
 * Main integration component - tích hợp tất cả các tính năng video call
 * @param {Object} props - Component props
 * @param {string} props.defaultView - Default view ('auth', 'videocall', 'appointments')
 * @param {Object} props.config - Configuration object
 * @param {Function} props.onError - Global error handler
 * @param {string} props.className - CSS class name
 */
const VideoCallIntegration = ({
  defaultView = 'auth',
  config = {},
  onError,
  className = 'video-call-integration'
}) => {
  // State
  const [currentView, setCurrentView] = useState(defaultView);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [webrtcSupport, setWebrtcSupport] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [activeCall, setActiveCall] = useState(null);

  // Check WebRTC support khi component mount
  useEffect(() => {
    const support = checkWebRTCSupport();
    setWebrtcSupport(support);

    if (!support.supported) {
      const message = 'Trình duyệt của bạn không hỗ trợ video call. Vui lòng sử dụng Chrome, Firefox hoặc Safari.';
      handleGlobalError(new Error(message));
    }

    // Check existing auth
    const existingToken = localStorage.getItem('videoCallToken');
    if (existingToken) {
      setToken(existingToken);
    }
  }, []);

  /**
   * Global error handler
   */
  const handleGlobalError = (error) => {
    console.error('Global error:', error);
    
    // Add to notifications
    const notification = {
      id: Date.now(),
      type: 'error',
      message: handleError(error),
      timestamp: new Date().toISOString()
    };
    
    setNotifications(prev => [notification, ...prev].slice(0, 5)); // Keep only last 5

    // Call external error handler
    if (onError) {
      onError(error);
    }

    // Show browser notification
    createNotification('Lỗi', handleError(error));
  };

  /**
   * Xử lý đăng nhập thành công
   */
  const handleLoginSuccess = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    setIsAuthenticated(true);
    setCurrentView('appointments'); // Chuyển đến view appointments sau khi login
    
    // Welcome notification
    createNotification(
      'Đăng nhập thành công', 
      `Xin chào ${userData.tenTK || userData.email}!`
    );
  };

  /**
   * Xử lý đăng xuất
   */
  const handleLogout = () => {
    setUser(null);
    setToken(null);
    setIsAuthenticated(false);
    setCurrentView('auth');
    setActiveCall(null);
    
    // Clear notifications
    setNotifications([]);
  };

  /**
   * Bắt đầu video call
   */
  const handleStartVideoCall = (callData = {}) => {
    if (!isAuthenticated) {
      handleGlobalError(new Error('Bạn cần đăng nhập để sử dụng tính năng này.'));
      return;
    }

    if (!webrtcSupport?.supported) {
      handleGlobalError(new Error('Trình duyệt không hỗ trợ video call.'));
      return;
    }

    setActiveCall(callData);
    setCurrentView('videocall');
  };

  /**
   * Kết thúc video call
   */
  const handleEndVideoCall = () => {
    setActiveCall(null);
    setCurrentView('appointments');
  };

  /**
   * Navigation handler
   */
  const handleNavigation = (view) => {
    if (!isAuthenticated && view !== 'auth') {
      handleGlobalError(new Error('Bạn cần đăng nhập để truy cập tính năng này.'));
      return;
    }
    
    setCurrentView(view);
  };

  /**
   * Dismiss notification
   */
  const dismissNotification = (notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  return (
    <div className={`${className} ${className}--${currentView}`}>
      {/* Header với navigation */}
      <div className={`${className}__header`}>
        <div className={`${className}__brand`}>
          <h1 className={`${className}__title`}>Video Call Translation</h1>
        </div>

        {isAuthenticated && (
          <nav className={`${className}__nav`}>
            <button
              onClick={() => handleNavigation('appointments')}
              className={`${className}__nav-btn ${currentView === 'appointments' ? `${className}__nav-btn--active` : ''}`}
            >
              📅 Lịch hẹn
            </button>
            <button
              onClick={() => handleNavigation('videocall')}
              className={`${className}__nav-btn ${currentView === 'videocall' ? `${className}__nav-btn--active` : ''}`}
            >
              📞 Video Call
            </button>
          </nav>
        )}

        {user && (
          <div className={`${className}__user-info`}>
            <span className={`${className}__user-name`}>
              {user.tenTK || user.email}
            </span>
            <button
              onClick={handleLogout}
              className={`${className}__logout-btn`}
            >
              Đăng xuất
            </button>
          </div>
        )}
      </div>

      {/* Notifications */}
      {notifications.length > 0 && (
        <div className={`${className}__notifications`}>
          {notifications.map(notification => (
            <div
              key={notification.id}
              className={`${className}__notification ${className}__notification--${notification.type}`}
            >
              <div className={`${className}__notification-content`}>
                {notification.message}
              </div>
              <button
                onClick={() => dismissNotification(notification.id)}
                className={`${className}__notification-close`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* WebRTC Support Warning */}
      {webrtcSupport && !webrtcSupport.supported && (
        <div className={`${className}__warning`}>
          <div className={`${className}__warning-content`}>
            <h3>⚠️ Trình duyệt không được hỗ trợ</h3>
            <p>Để sử dụng tính năng video call, vui lòng sử dụng:</p>
            <ul>
              <li>Google Chrome (phiên bản mới nhất)</li>
              <li>Mozilla Firefox (phiên bản mới nhất)</li>
              <li>Safari (phiên bản mới nhất)</li>
              <li>Microsoft Edge (phiên bản mới nhất)</li>
            </ul>
            <p><strong>Tính năng bị thiếu:</strong></p>
            <ul>
              {!webrtcSupport.getUserMedia && <li>Truy cập camera/microphone</li>}
              {!webrtcSupport.peerConnection && <li>Kết nối video peer-to-peer</li>}
              {!webrtcSupport.webSocket && <li>Kết nối realtime</li>}
            </ul>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className={`${className}__content`}>
        {/* Authentication View */}
        {currentView === 'auth' && (
          <AuthenticationComponent
            onLogin={handleLoginSuccess}
            onError={handleGlobalError}
            className={`${className}__auth`}
          />
        )}

        {/* Appointments View */}
        {currentView === 'appointments' && isAuthenticated && (
          <AppointmentManager
            user={user}
            onStartCall={handleStartVideoCall}
            onError={handleGlobalError}
            className={`${className}__appointments`}
          />
        )}

        {/* Video Call View */}
        {currentView === 'videocall' && isAuthenticated && (
          <VideoCallComponent
            user={user}
            token={token}
            sessionId={activeCall?.sessionId}
            onError={handleGlobalError}
            onCallEnd={handleEndVideoCall}
            className={`${className}__videocall`}
          />
        )}
      </div>

      {/* Footer */}
      <div className={`${className}__footer`}>
        <div className={`${className}__footer-content`}>
          <p className={`${className}__footer-text`}>
            Video Call Translation System - Tích hợp vào website hiện tại
          </p>
          <div className={`${className}__connection-status`}>
            <span className={`${className}__status-indicator ${isAuthenticated ? 'connected' : 'disconnected'}`}>
              {isAuthenticated ? '🟢 Đã kết nối' : '🔴 Chưa đăng nhập'}
            </span>
          </div>
        </div>
      </div>

      {/* Floating Video Call Button */}
      {isAuthenticated && currentView !== 'videocall' && !activeCall && (
        <button
          onClick={() => handleStartVideoCall()}
          className={`${className}__floating-call-btn`}
          title=\"Bắt đầu video call nhanh\"
        >
          📞
        </button>
      )}
    </div>
  );
};

export default VideoCallIntegration;

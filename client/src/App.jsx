import React, { useState, useEffect } from 'react';
import { initializeSocket } from './services/socket';
import VideoCall from './components/VideoCall/VideoCall';
import TranslationPanel from './components/Translation/TranslationPanel';
import LanguageSelector from './components/UI/LanguageSelector';
import LoginForm from './components/Auth/LoginForm';
import UserList from './components/Call/UserList';
import IncomingCallModal from './components/Call/IncomingCallModal';
import { CallProvider } from './contexts/CallContext';
import { TranslationProvider } from './contexts/TranslationContext';
import { UserProvider, useUser } from './contexts/UserContext';
import { CallNotificationProvider } from './contexts/CallNotificationContext';
import config from './config/connection';
import './App.css';

// Main App component that handles authentication state
function AppContent() {
  const { user, isAuthenticated } = useUser();
  const [socket, setSocket] = useState(null);
  const [connectionError, setConnectionError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize socket connection
  useEffect(() => {
    try {
      const socketUrl = config.socketUrl;
      console.log('Connecting to socket at:', socketUrl);
      const socketInstance = initializeSocket(socketUrl);
      
      setSocket(socketInstance);
      
      socketInstance.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
        setConnectionError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra xem máy chủ đã chạy chưa.');
        setIsLoading(false);
      });

      // If connected, mark as ready
      socketInstance.on('connect', () => {
        console.log('Socket connected successfully');
        setIsLoading(false);
      });
      
      // Cleanup on unmount
      return () => {
        if (socketInstance) {
          socketInstance.disconnect();
        }
      };
    } catch (error) {
      console.error('Error initializing socket:', error);
      setConnectionError('Khởi tạo kết nối thất bại: ' + error.message);
      setIsLoading(false);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="loading-container">
        <h2>Đang kết nối...</h2>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="error-container">
        <h2>Lỗi Kết Nối</h2>
        <p>{connectionError}</p>
        <button onClick={() => window.location.reload()}>
          Tải Lại Trang
        </button>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="app-container">
        <header>
          <h1>Video Call Translation</h1>
          <div className="version-info">
            <small>Real-time Translation Platform</small>
          </div>
        </header>
        
        <main className="login-main">
          <LoginForm />
        </main>
        
        <footer>
          <p>Powered by PhoWhisper & OPUS-MT</p>
        </footer>
      </div>
    );
  }

  // Show main app if authenticated
  return (
    <CallNotificationProvider socket={socket}>
      <CallProvider socket={socket} user={user}>
        <TranslationProvider socket={socket}>
          <div className="app-container">
            <header>
              <h1>Video Call Translation</h1>
              <div className="user-info">
                <img src={user.avatar} alt={user.username} className="user-avatar" />
                <span>Welcome, {user.username}</span>
              </div>
            </header>

            <main className="content">
              <div className="sidebar">
                <UserList />
              </div>
              
              <div className="main-content">
                <div className="video-section">
                  <VideoCall />
                </div>
                
                <div className="controls-section">
                  <div className="control-panel">
                    <h3>Cài Đặt Dịch Thuật</h3>
                    <LanguageSelector />
                    <TranslationPanel />
                  </div>
                </div>
              </div>
            </main>
            
            <IncomingCallModal />
            
            <footer>
              <p>Powered by PhoWhisper & OPUS-MT</p>
            </footer>
          </div>
        </TranslationProvider>
      </CallProvider>
    </CallNotificationProvider>
  );
}

function App() {
  return (
    <UserProvider>
      <AppContent />
    </UserProvider>
  );
}

export default App;
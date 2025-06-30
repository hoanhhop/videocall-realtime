import React from 'react';
import VideoCallIntegration from './components/VideoCallIntegration';
import './styles/video-call-integration.css';

/**
 * Example implementation của Video Call Integration
 * Copy và modify file này cho website React của bạn
 */

const ExampleApp = () => {
  // Simulate user data - thay thế bằng user data thực từ hệ thống của bạn
  const currentUser = {
    id: 1,
    name: 'John Doe',
    email: 'john@example.com',
    // Các field khác từ bảng taikhoan
  };

  return (
    <div className="example-app">
      <header className="app-header">
        <h1>My Website</h1>
        <nav>
          {/* Existing navigation */}
        </nav>
      </header>

      <main className="app-main">
        {/* Existing content */}
        <section className="existing-content">
          <h2>Welcome to my website</h2>
          <p>This is your existing content...</p>
        </section>

        {/* Video Call Integration */}
        <section className="video-call-section">
          <VideoCallIntegration 
            userId={currentUser?.id}
            userName={currentUser?.name}
            userEmail={currentUser?.email}
            // Optional props
            onCallStart={(callId) => console.log('Call started:', callId)}
            onCallEnd={(callId) => console.log('Call ended:', callId)}
            onError={(error) => console.error('Video call error:', error)}
          />
        </section>
      </main>

      <footer className="app-footer">
        {/* Existing footer */}
      </footer>
    </div>
  );
};

export default ExampleApp;

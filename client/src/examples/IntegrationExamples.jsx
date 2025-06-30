// Example: How to integrate Video Call Widget into your existing React website

import React, { useState, useEffect } from 'react';
import { VideoCallProvider } from './path/to/VideoCallContext';
import VideoCallWidget from './path/to/VideoCallWidget';

// Assuming you have user data from your existing authentication system
const ExamplePage = () => {
  // This would come from your existing user context/auth system
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);

  // Example: Get user data from your existing auth system
  useEffect(() => {
    // Replace this with your actual user fetching logic
    const fetchUserData = async () => {
      try {
        // Get user from your existing API/context
        const userData = await getCurrentUserFromYourAPI();
        setCurrentUser(userData);
        
        // Get auth token for video call integration
        const token = await getAuthTokenFromYourAPI();
        setAuthToken(token);
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, []);

  // Handle call events
  const handleCallStart = (callData) => {
    console.log('Video call started:', callData);
    // You can implement analytics, notifications, etc.
    
    // Example: Track call in your analytics
    trackEvent('video_call_started', {
      partner: callData.partner?.username,
      roomId: callData.roomId
    });
  };

  const handleCallEnd = (callData) => {
    console.log('Video call ended:', callData);
    // You can save call history, update UI, etc.
    
    // Example: Save to your database
    savCallHistory({
      partnerId: callData.partner?.id,
      duration: callData.duration,
      endTime: new Date()
    });
  };

  if (!currentUser) {
    return <div>Loading...</div>;
  }

  return (
    <div className="your-existing-page">
      {/* Your existing page content */}
      <h1>Welcome to Your Website</h1>
      <div className="your-content">
        {/* Your existing components */}
      </div>

      {/* Video Call Integration */}
      <VideoCallProvider 
        currentUser={{
          id: currentUser.id,
          username: currentUser.username || currentUser.name,
          email: currentUser.email,
          avatar: currentUser.avatar || currentUser.profile_picture
        }}
        serverUrl={process.env.REACT_APP_VIDEO_CALL_SERVER_URL || 'http://localhost:5001'}
        authToken={authToken}
      >
        <VideoCallWidget
          onCallStart={handleCallStart}
          onCallEnd={handleCallEnd}
          position="bottom-right"
          theme="default"
          showUserList={true}
          autoHide={true}
        />
      </VideoCallProvider>
    </div>
  );
};

// Example of integrating into a user profile page
const UserProfile = ({ userId }) => {
  const [user, setUser] = useState(null);
  const [availableUsers, setAvailableUsers] = useState([]);

  useEffect(() => {
    // Fetch user data and available users for calling
    const fetchData = async () => {
      const userData = await fetchUserById(userId);
      setUser(userData);
      
      // Get other users who are available for video calling
      const users = await fetchAvailableUsersForCalling();
      setAvailableUsers(users);
    };

    fetchData();
  }, [userId]);

  return (
    <div className="user-profile">
      <div className="profile-header">
        <img src={user?.avatar} alt={user?.username} />
        <h1>{user?.username}</h1>
      </div>

      <div className="profile-content">
        {/* Your existing profile content */}
      </div>

      {/* Video Call Widget - only for specific users */}
      {user && (
        <VideoCallProvider currentUser={user}>
          <VideoCallWidget
            targetUsers={availableUsers}
            position="bottom-right"
            theme="blue"
          />
        </VideoCallProvider>
      )}
    </div>
  );
};

// Example of integrating into a chat/messaging page
const ChatPage = () => {
  const { currentUser } = useYourAuth(); // Your existing auth context
  const [chatPartner, setChatPartner] = useState(null);

  return (
    <div className="chat-page">
      <div className="chat-sidebar">
        {/* Your chat list */}
      </div>

      <div className="chat-content">
        {/* Your chat messages */}
        
        {/* Video call button in chat header */}
        {chatPartner && (
          <VideoCallProvider currentUser={currentUser}>
            <VideoCallWidget
              targetUsers={[chatPartner]}
              position="top-right"
              theme="dark"
              showUserList={false}
            />
          </VideoCallProvider>
        )}
      </div>
    </div>
  );
};

// Example API helper functions for your existing system
const getCurrentUserFromYourAPI = async () => {
  const response = await fetch('/api/user/me', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('yourAuthToken')}`
    }
  });
  return response.json();
};

const getAuthTokenFromYourAPI = async () => {
  // Generate or get video call auth token from your backend
  const response = await fetch('/api/video-call/auth-token', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('yourAuthToken')}`
    }
  });
  const data = await response.json();
  return data.token;
};

const fetchAvailableUsersForCalling = async () => {
  const response = await fetch('/api/users/available-for-calling');
  const data = await response.json();
  return data.users;
};

const trackEvent = (eventName, data) => {
  // Your analytics tracking
  console.log('Analytics:', eventName, data);
};

const savCallHistory = (callData) => {
  // Save to your database
  fetch('/api/call-history', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(callData)
  });
};

export { ExamplePage, UserProfile, ChatPage };

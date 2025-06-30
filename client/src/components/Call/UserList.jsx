// client/src/components/Call/UserList.jsx
import React from 'react';
import { useUser } from '../../contexts/UserContext';
import { useCallNotification } from '../../contexts/CallNotificationContext';
import './UserList.css';

const UserList = () => {
  const { user, onlineUsers } = useUser();
  const { initiateCall, outgoingCall } = useCallNotification();

  const handleCallUser = (targetUser) => {
    if (targetUser.id === user.id) return;
    if (outgoingCall) return; // Already in a call
    
    initiateCall(targetUser);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'online': return '#4CAF50';
      case 'busy': return '#FF9800';
      case 'away': return '#FFC107';
      default: return '#9E9E9E';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'online': return 'Online';
      case 'busy': return 'Busy';
      case 'away': return 'Away';
      default: return 'Offline';
    }
  };

  return (
    <div className="user-list">
      <h3>Online Users ({onlineUsers.length})</h3>
      
      {onlineUsers.length === 0 ? (
        <div className="no-users">
          <p>No other users online</p>
        </div>
      ) : (
        <div className="users-grid">
          {onlineUsers
            .filter(u => u.id !== user?.id)
            .map((onlineUser) => (
              <div key={onlineUser.id} className="user-card">
                <div className="user-avatar">
                  <img 
                    src={onlineUser.avatar || '/default-avatar.png'} 
                    alt={onlineUser.username}
                    onError={(e) => {
                      e.target.src = '/default-avatar.png';
                    }}
                  />
                  <div 
                    className="status-indicator"
                    style={{ backgroundColor: getStatusColor(onlineUser.status) }}
                  ></div>
                </div>
                
                <div className="user-info">
                  <h4>{onlineUser.username}</h4>
                  <p className="user-status">
                    {getStatusText(onlineUser.status)}
                  </p>
                  {onlineUser.language && (
                    <p className="user-language">
                      🌐 {onlineUser.language.toUpperCase()}
                    </p>
                  )}
                </div>
                
                <div className="user-actions">
                  <button
                    className={`call-btn ${outgoingCall ? 'disabled' : ''}`}
                    onClick={() => handleCallUser(onlineUser)}
                    disabled={!!outgoingCall || onlineUser.status === 'busy'}
                    title={
                      outgoingCall ? 'Call in progress' : 
                      onlineUser.status === 'busy' ? 'User is busy' : 
                      `Call ${onlineUser.username}`
                    }
                  >
                    {outgoingCall && outgoingCall.callee.id === onlineUser.id ? (
                      <span className="calling">📞 Calling...</span>
                    ) : (
                      <span>📞 Call</span>
                    )}
                  </button>
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
};

export default UserList;

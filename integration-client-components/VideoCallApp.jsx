import React, { useState, useEffect } from 'react';
import AuthenticationComponent from './AuthenticationComponent';
import AppointmentManager from './AppointmentManager';
import VideoCallIntegration from './VideoCallIntegration';
import { X } from 'lucide-react';

const VideoCallApp = ({ 
  serverUrl = 'https://34.142.175.163',
  className = '',
  onClose
}) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [currentView, setCurrentView] = useState('auth'); // auth, appointments, video-call
  const [activeAppointment, setActiveAppointment] = useState(null);

  const handleAuthSuccess = (userToken, userData) => {
    setToken(userToken);
    setUser(userData);
    
    if (userToken && userData) {
      setCurrentView('appointments');
    } else {
      setCurrentView('auth');
    }
  };

  const handleAuthError = (error) => {
    console.error('Authentication error:', error);
    setCurrentView('auth');
  };

  const handleStartVideoCall = (appointment) => {
    setActiveAppointment(appointment);
    setCurrentView('video-call');
  };

  const handleEndVideoCall = () => {
    setActiveAppointment(null);
    setCurrentView('appointments');
  };

  const handleBackToAppointments = () => {
    setCurrentView('appointments');
  };

  return (
    <div className={`video-call-app ${className}`}>
      <div className="bg-white min-h-screen">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 sticky top-0 z-10">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-bold">Video Call Translation</h1>
              {user && (
                <div className="text-sm opacity-90">
                  Xin chào, {user.hoTen || user.tenTK}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              {/* Navigation buttons */}
              {currentView === 'video-call' && (
                <button
                  onClick={handleBackToAppointments}
                  className="px-3 py-1 bg-blue-700 hover:bg-blue-800 rounded text-sm transition-colors"
                >
                  ← Quay lại
                </button>
              )}
              {onClose && (
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-blue-700 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto p-4">
          {currentView === 'auth' && (
            <div className="max-w-md mx-auto mt-8">
              <AuthenticationComponent
                serverUrl={serverUrl}
                onAuthSuccess={handleAuthSuccess}
                onAuthError={handleAuthError}
              />
            </div>
          )}

          {currentView === 'appointments' && user && token && (
            <div className="max-w-4xl mx-auto">
              <AppointmentManager
                userToken={token}
                userId={user.Id}
                serverUrl={serverUrl}
                onStartVideoCall={handleStartVideoCall}
              />
            </div>
          )}

          {currentView === 'video-call' && activeAppointment && token && (
            <div className="max-w-6xl mx-auto">
              <VideoCallIntegration
                appointmentId={activeAppointment.Id}
                userToken={token}
                serverUrl={serverUrl}
                onCallEnd={handleEndVideoCall}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoCallApp;

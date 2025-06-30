import React, { useState, useEffect } from 'react';
import AppointmentManager from './components/AppointmentManager';
import { VideoCallAPI } from './utils/api';

/**
 * Example: Tích hợp với appointment system hiện có
 */
const AppointmentIntegrationExample = () => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const api = new VideoCallAPI('https://34.142.175.163/video-call-api');

  useEffect(() => {
    loadAppointments();
  }, []);

  const loadAppointments = async () => {
    try {
      setLoading(true);
      const data = await api.getAppointments();
      setAppointments(data);
    } catch (error) {
      console.error('Error loading appointments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAppointment = async (appointmentData) => {
    try {
      await api.createAppointment(appointmentData);
      await loadAppointments(); // Refresh list
    } catch (error) {
      console.error('Error creating appointment:', error);
    }
  };

  const handleStartVideoCall = async (appointmentId) => {
    try {
      const callSession = await api.startVideoCall({
        appointmentId,
        roomId: `appointment-${appointmentId}`
      });
      
      // Redirect to video call
      window.location.href = `/video-call/${callSession.roomId}`;
    } catch (error) {
      console.error('Error starting video call:', error);
    }
  };

  if (loading) {
    return <div>Loading appointments...</div>;
  }

  return (
    <div className="appointment-integration">
      <h2>Appointment Management with Video Calls</h2>
      
      <AppointmentManager
        userId="current-user-id"
        onCreateAppointment={handleCreateAppointment}
        onStartVideoCall={handleStartVideoCall}
        appointments={appointments}
      />
      
      {/* Integration with existing appointment UI */}
      <div className="existing-appointments">
        <h3>Your Existing Appointments</h3>
        {appointments.map(appointment => (
          <div key={appointment.id} className="appointment-card">
            <h4>{appointment.title}</h4>
            <p>Date: {new Date(appointment.ngayhen).toLocaleDateString()}</p>
            <p>Time: {appointment.thoigian}</p>
            <button 
              onClick={() => handleStartVideoCall(appointment.id)}
              className="start-call-btn"
            >
              Start Video Call
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AppointmentIntegrationExample;

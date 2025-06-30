import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Video, User, MapPin, FileText } from 'lucide-react';

const AppointmentManager = ({ 
  userToken,
  userId,
  serverUrl = 'https://34.142.175.163',
  onStartVideoCall,
  className = ''
}) => {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newAppointment, setNewAppointment] = useState({
    tieuDe: '',
    moTa: '',
    ngayGio: '',
    diaDiem: '',
    trangThai: 'scheduled'
  });

  useEffect(() => {
    if (userToken && userId) {
      fetchAppointments();
    }
  }, [userToken, userId]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${serverUrl}/api/integration/appointments`, {
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error('Không thể tải danh sách cuộc hẹn');
      }

      const data = await response.json();
      setAppointments(data.appointments || []);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const createAppointment = async () => {
    try {
      setError(null);

      const response = await fetch(`${serverUrl}/api/integration/appointments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newAppointment)
      });

      if (!response.ok) {
        throw new Error('Không thể tạo cuộc hẹn');
      }

      const data = await response.json();
      setAppointments(prev => [data.appointment, ...prev]);
      setShowCreateForm(false);
      setNewAppointment({
        tieuDe: '',
        moTa: '',
        ngayGio: '',
        diaDiem: '',
        trangThai: 'scheduled'
      });
    } catch (error) {
      console.error('Error creating appointment:', error);
      setError(error.message);
    }
  };

  const updateAppointmentStatus = async (appointmentId, status) => {
    try {
      const response = await fetch(`${serverUrl}/api/integration/appointments/${appointmentId}/status`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${userToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ trangThai: status })
      });

      if (!response.ok) {
        throw new Error('Không thể cập nhật trạng thái cuộc hẹn');
      }

      setAppointments(prev => 
        prev.map(apt => 
          apt.Id === appointmentId 
            ? { ...apt, trangThai: status }
            : apt
        )
      );
    } catch (error) {
      console.error('Error updating appointment status:', error);
      setError(error.message);
    }
  };

  const startVideoCall = (appointment) => {
    if (onStartVideoCall) {
      onStartVideoCall(appointment);
    }
  };

  const formatDateTime = (dateTimeString) => {
    const date = new Date(dateTimeString);
    return {
      date: date.toLocaleDateString('vi-VN'),
      time: date.toLocaleTimeString('vi-VN', { 
        hour: '2-digit', 
        minute: '2-digit' 
      })
    };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'in_progress': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'scheduled': return 'Đã lên lịch';
      case 'in_progress': return 'Đang diễn ra';
      case 'completed': return 'Hoàn thành';
      case 'cancelled': return 'Đã hủy';
      default: return 'Không xác định';
    }
  };

  if (loading) {
    return (
      <div className={`appointment-manager ${className}`}>
        <div className="flex items-center justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Đang tải...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`appointment-manager ${className}`}>
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 text-white p-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Quản lý cuộc hẹn</h3>
            <button
              onClick={() => setShowCreateForm(true)}
              className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Tạo cuộc hẹn mới
            </button>
          </div>
          {error && (
            <div className="mt-2 p-2 bg-red-500 rounded text-sm">
              {error}
            </div>
          )}
        </div>

        {/* Create Appointment Form */}
        {showCreateForm && (
          <div className="p-4 border-b bg-gray-50">
            <h4 className="font-medium mb-3">Tạo cuộc hẹn mới</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tiêu đề
                </label>
                <input
                  type="text"
                  value={newAppointment.tieuDe}
                  onChange={(e) => setNewAppointment(prev => ({ ...prev, tieuDe: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhập tiêu đề cuộc hẹn"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ngày giờ
                </label>
                <input
                  type="datetime-local"
                  value={newAppointment.ngayGio}
                  onChange={(e) => setNewAppointment(prev => ({ ...prev, ngayGio: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Địa điểm
                </label>
                <input
                  type="text"
                  value={newAppointment.diaDiem}
                  onChange={(e) => setNewAppointment(prev => ({ ...prev, diaDiem: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhập địa điểm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mô tả
                </label>
                <textarea
                  value={newAppointment.moTa}
                  onChange={(e) => setNewAppointment(prev => ({ ...prev, moTa: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhập mô tả cuộc hẹn"
                  rows="2"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-2 mt-4">
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={createAppointment}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Tạo cuộc hẹn
              </button>
            </div>
          </div>
        )}

        {/* Appointments List */}
        <div className="p-4">
          {appointments.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p>Chưa có cuộc hẹn nào</p>
            </div>
          ) : (
            <div className="space-y-4">
              {appointments.map((appointment) => {
                const { date, time } = formatDateTime(appointment.ngayGio);
                
                return (
                  <div
                    key={appointment.Id}
                    className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 mb-1">
                          {appointment.tieuDe}
                        </h4>
                        <div className="flex items-center text-sm text-gray-600 space-x-4">
                          <div className="flex items-center">
                            <Calendar className="w-4 h-4 mr-1" />
                            {date}
                          </div>
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 mr-1" />
                            {time}
                          </div>
                          {appointment.diaDiem && (
                            <div className="flex items-center">
                              <MapPin className="w-4 h-4 mr-1" />
                              {appointment.diaDiem}
                            </div>
                          )}
                        </div>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(appointment.trangThai)}`}>
                        {getStatusText(appointment.trangThai)}
                      </span>
                    </div>

                    {appointment.moTa && (
                      <div className="mb-3">
                        <div className="flex items-center text-sm text-gray-600 mb-1">
                          <FileText className="w-4 h-4 mr-1" />
                          Mô tả
                        </div>
                        <p className="text-sm text-gray-700 pl-5">
                          {appointment.moTa}
                        </p>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-between items-center">
                      <div className="flex space-x-2">
                        {appointment.trangThai === 'scheduled' && (
                          <>
                            <button
                              onClick={() => updateAppointmentStatus(appointment.Id, 'in_progress')}
                              className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
                            >
                              Bắt đầu
                            </button>
                            <button
                              onClick={() => updateAppointmentStatus(appointment.Id, 'cancelled')}
                              className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                            >
                              Hủy
                            </button>
                          </>
                        )}
                        {appointment.trangThai === 'in_progress' && (
                          <button
                            onClick={() => updateAppointmentStatus(appointment.Id, 'completed')}
                            className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                          >
                            Hoàn thành
                          </button>
                        )}
                      </div>

                      {(appointment.trangThai === 'scheduled' || appointment.trangThai === 'in_progress') && (
                        <button
                          onClick={() => startVideoCall(appointment)}
                          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Video className="w-4 h-4 mr-2" />
                          Video Call
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppointmentManager;

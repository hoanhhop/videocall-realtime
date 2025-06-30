import React, { useState, useEffect } from 'react';
import { videoCallAPI } from '../utils/api';
import { formatDateTime, formatDate, formatTime, handleError } from '../utils/helpers';

/**
 * Component quản lý appointments và lịch hẹn
 * @param {Object} props - Component props
 * @param {Object} props.user - Current user object
 * @param {Function} props.onStartCall - Callback khi bắt đầu cuộc gọi từ appointment
 * @param {Function} props.onError - Error callback
 * @param {string} props.className - CSS class name
 */
const AppointmentManager = ({
  user,
  onStartCall,
  onError,
  className = 'appointment-manager'
}) => {
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [filter, setFilter] = useState('all'); // all, upcoming, past, today

  // Form data cho tạo appointment mới
  const [formData, setFormData] = useState({
    patientName: '',
    phoneNumber: '',
    email: '',
    appointmentDate: '',
    appointmentTime: '',
    notes: '',
    type: 'consultation'
  });

  const [formErrors, setFormErrors] = useState({});

  // Load appointments khi component mount
  useEffect(() => {
    loadAppointments();
  }, []);

  /**
   * Load danh sách appointments
   */
  const loadAppointments = async () => {
    try {
      setIsLoading(true);
      const response = await videoCallAPI.getAppointments();
      
      if (response.success) {
        setAppointments(response.appointments || []);
      }
    } catch (error) {
      const errorMsg = handleError(error);
      if (onError) onError(error);
      console.error('Failed to load appointments:', errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Xử lý thay đổi input form
   */
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Xóa error khi user bắt đầu nhập
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  /**
   * Validate form data
   */
  const validateForm = () => {
    const errors = {};

    if (!formData.patientName.trim()) {
      errors.patientName = 'Tên bệnh nhân không được để trống';
    }

    if (!formData.phoneNumber.trim()) {
      errors.phoneNumber = 'Số điện thoại không được để trống';
    } else if (!/^[0-9+\-\s()]+$/.test(formData.phoneNumber)) {
      errors.phoneNumber = 'Số điện thoại không hợp lệ';
    }

    if (!formData.appointmentDate) {
      errors.appointmentDate = 'Ngày hẹn không được để trống';
    } else {
      const selectedDate = new Date(formData.appointmentDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (selectedDate < today) {
        errors.appointmentDate = 'Ngày hẹn không thể là ngày trong quá khứ';
      }
    }

    if (!formData.appointmentTime) {
      errors.appointmentTime = 'Giờ hẹn không được để trống';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Tạo appointment mới
   */
  const handleCreateAppointment = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setIsLoading(true);

      // Kết hợp date và time
      const appointmentDateTime = new Date(`${formData.appointmentDate}T${formData.appointmentTime}`);

      const appointmentData = {
        ...formData,
        appointmentDateTime: appointmentDateTime.toISOString(),
        doctorId: user.Id,
        status: 'scheduled'
      };

      const response = await videoCallAPI.createAppointment(appointmentData);

      if (response.success) {
        // Reset form
        setFormData({
          patientName: '',
          phoneNumber: '',
          email: '',
          appointmentDate: '',
          appointmentTime: '',
          notes: '',
          type: 'consultation'
        });
        setShowCreateForm(false);
        
        // Reload appointments
        await loadAppointments();
      }
    } catch (error) {
      const errorMsg = handleError(error);
      if (onError) onError(error);
      setFormErrors({ general: errorMsg });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Cập nhật status appointment
   */
  const updateAppointmentStatus = async (appointmentId, newStatus) => {
    try {
      setIsLoading(true);
      const response = await videoCallAPI.updateAppointment(appointmentId, {
        status: newStatus
      });

      if (response.success) {
        await loadAppointments();
      }
    } catch (error) {
      const errorMsg = handleError(error);
      if (onError) onError(error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Xóa appointment
   */
  const deleteAppointment = async (appointmentId) => {
    if (!confirm('Bạn có chắc chắn muốn xóa lịch hẹn này?')) {
      return;
    }

    try {
      setIsLoading(true);
      const response = await videoCallAPI.deleteAppointment(appointmentId);

      if (response.success) {
        await loadAppointments();
      }
    } catch (error) {
      const errorMsg = handleError(error);
      if (onError) onError(error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Bắt đầu video call từ appointment
   */
  const startVideoCallFromAppointment = async (appointment) => {
    if (onStartCall) {
      // Update appointment status to in-progress
      await updateAppointmentStatus(appointment.id, 'in-progress');
      
      // Start video call
      onStartCall({
        appointmentId: appointment.id,
        patientName: appointment.patientName,
        type: 'appointment'
      });
    }
  };

  /**
   * Filter appointments dựa trên filter hiện tại
   */
  const getFilteredAppointments = () => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return appointments.filter(appointment => {
      const appointmentDate = new Date(appointment.appointmentDateTime);
      const appointmentDay = new Date(appointmentDate.getFullYear(), appointmentDate.getMonth(), appointmentDate.getDate());

      switch (filter) {
        case 'today':
          return appointmentDay.getTime() === today.getTime();
        case 'upcoming':
          return appointmentDate >= now && appointment.status !== 'completed' && appointment.status !== 'cancelled';
        case 'past':
          return appointmentDate < now || appointment.status === 'completed';
        default:
          return true;
      }
    });
  };

  const filteredAppointments = getFilteredAppointments();

  return (
    <div className={`${className}`}>
      {/* Header */}
      <div className={`${className}__header`}>
        <h2 className={`${className}__title`}>Quản lý lịch hẹn</h2>
        <button
          onClick={() => setShowCreateForm(true)}
          className={`${className}__btn ${className}__btn--primary`}
          disabled={isLoading}
        >
          Tạo lịch hẹn mới
        </button>
      </div>

      {/* Filters */}
      <div className={`${className}__filters`}>
        <button
          onClick={() => setFilter('all')}
          className={`${className}__filter-btn ${filter === 'all' ? `${className}__filter-btn--active` : ''}`}
        >
          Tất cả ({appointments.length})
        </button>
        <button
          onClick={() => setFilter('today')}
          className={`${className}__filter-btn ${filter === 'today' ? `${className}__filter-btn--active` : ''}`}
        >
          Hôm nay
        </button>
        <button
          onClick={() => setFilter('upcoming')}
          className={`${className}__filter-btn ${filter === 'upcoming' ? `${className}__filter-btn--active` : ''}`}
        >
          Sắp tới
        </button>
        <button
          onClick={() => setFilter('past')}
          className={`${className}__filter-btn ${filter === 'past' ? `${className}__filter-btn--active` : ''}`}
        >
          Đã qua
        </button>
      </div>

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className={`${className}__modal`}>
          <div className={`${className}__modal-content`}>
            <div className={`${className}__modal-header`}>
              <h3>Tạo lịch hẹn mới</h3>
              <button
                onClick={() => setShowCreateForm(false)}
                className={`${className}__modal-close`}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className={`${className}__form`}>
              {formErrors.general && (
                <div className={`${className}__error`}>
                  {formErrors.general}
                </div>
              )}

              <div className={`${className}__form-row`}>
                <div className={`${className}__form-group`}>
                  <label className={`${className}__label`}>Tên bệnh nhân *</label>
                  <input
                    type=\"text\"
                    name=\"patientName\"
                    value={formData.patientName}
                    onChange={handleInputChange}
                    className={`${className}__input ${formErrors.patientName ? `${className}__input--error` : ''}`}
                    placeholder=\"Nhập tên bệnh nhân\"
                  />
                  {formErrors.patientName && (
                    <span className={`${className}__field-error`}>{formErrors.patientName}</span>
                  )}
                </div>

                <div className={`${className}__form-group`}>
                  <label className={`${className}__label`}>Số điện thoại *</label>
                  <input
                    type=\"tel\"
                    name=\"phoneNumber\"
                    value={formData.phoneNumber}
                    onChange={handleInputChange}
                    className={`${className}__input ${formErrors.phoneNumber ? `${className}__input--error` : ''}`}
                    placeholder=\"Nhập số điện thoại\"
                  />
                  {formErrors.phoneNumber && (
                    <span className={`${className}__field-error`}>{formErrors.phoneNumber}</span>
                  )}
                </div>
              </div>

              <div className={`${className}__form-row`}>
                <div className={`${className}__form-group`}>
                  <label className={`${className}__label`}>Email</label>
                  <input
                    type=\"email\"
                    name=\"email\"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`${className}__input`}
                    placeholder=\"Nhập email (tùy chọn)\"
                  />
                </div>

                <div className={`${className}__form-group`}>
                  <label className={`${className}__label`}>Loại hẹn</label>
                  <select
                    name=\"type\"
                    value={formData.type}
                    onChange={handleInputChange}
                    className={`${className}__select`}
                  >
                    <option value=\"consultation\">Tư vấn</option>
                    <option value=\"checkup\">Khám bệnh</option>
                    <option value=\"follow-up\">Tái khám</option>
                    <option value=\"other\">Khác</option>
                  </select>
                </div>
              </div>

              <div className={`${className}__form-row`}>
                <div className={`${className}__form-group`}>
                  <label className={`${className}__label`}>Ngày hẹn *</label>
                  <input
                    type=\"date\"
                    name=\"appointmentDate\"
                    value={formData.appointmentDate}
                    onChange={handleInputChange}
                    className={`${className}__input ${formErrors.appointmentDate ? `${className}__input--error` : ''}`}
                    min={new Date().toISOString().split('T')[0]}
                  />
                  {formErrors.appointmentDate && (
                    <span className={`${className}__field-error`}>{formErrors.appointmentDate}</span>
                  )}
                </div>

                <div className={`${className}__form-group`}>
                  <label className={`${className}__label`}>Giờ hẹn *</label>
                  <input
                    type=\"time\"
                    name=\"appointmentTime\"
                    value={formData.appointmentTime}
                    onChange={handleInputChange}
                    className={`${className}__input ${formErrors.appointmentTime ? `${className}__input--error` : ''}`}
                  />
                  {formErrors.appointmentTime && (
                    <span className={`${className}__field-error`}>{formErrors.appointmentTime}</span>
                  )}
                </div>
              </div>

              <div className={`${className}__form-group`}>
                <label className={`${className}__label`}>Ghi chú</label>
                <textarea
                  name=\"notes\"
                  value={formData.notes}
                  onChange={handleInputChange}
                  className={`${className}__textarea`}
                  placeholder=\"Nhập ghi chú (tùy chọn)\"
                  rows={3}
                />
              </div>

              <div className={`${className}__form-actions`}>
                <button
                  type=\"button\"
                  onClick={() => setShowCreateForm(false)}
                  className={`${className}__btn ${className}__btn--secondary`}
                >
                  Hủy
                </button>
                <button
                  type=\"submit\"
                  disabled={isLoading}
                  className={`${className}__btn ${className}__btn--primary`}
                >
                  {isLoading ? 'Đang tạo...' : 'Tạo lịch hẹn'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Appointments List */}
      <div className={`${className}__appointments`}>
        {isLoading && !showCreateForm && (
          <div className={`${className}__loading`}>Đang tải...</div>
        )}

        {!isLoading && filteredAppointments.length === 0 && (
          <div className={`${className}__empty`}>
            {filter === 'all' ? 'Chưa có lịch hẹn nào' : `Không có lịch hẹn ${filter === 'today' ? 'hôm nay' : filter === 'upcoming' ? 'sắp tới' : 'đã qua'}`}
          </div>
        )}

        {filteredAppointments.map(appointment => (
          <div 
            key={appointment.id} 
            className={`${className}__appointment ${className}__appointment--${appointment.status}`}
          >
            <div className={`${className}__appointment-main`}>
              <div className={`${className}__appointment-info`}>
                <h4 className={`${className}__patient-name`}>
                  {appointment.patientName}
                </h4>
                <div className={`${className}__appointment-details`}>
                  <span className={`${className}__datetime`}>
                    📅 {formatDate(appointment.appointmentDateTime)} - {formatTime(appointment.appointmentDateTime)}
                  </span>
                  <span className={`${className}__phone`}>
                    📞 {appointment.phoneNumber}
                  </span>
                  {appointment.email && (
                    <span className={`${className}__email`}>
                      ✉️ {appointment.email}
                    </span>
                  )}
                </div>
                {appointment.notes && (
                  <div className={`${className}__notes`}>
                    💬 {appointment.notes}
                  </div>
                )}
              </div>

              <div className={`${className}__appointment-status`}>
                <span className={`${className}__status-badge ${className}__status-badge--${appointment.status}`}>
                  {appointment.status === 'scheduled' && 'Đã lên lịch'}
                  {appointment.status === 'confirmed' && 'Đã xác nhận'}
                  {appointment.status === 'in-progress' && 'Đang diễn ra'}
                  {appointment.status === 'completed' && 'Hoàn thành'}
                  {appointment.status === 'cancelled' && 'Đã hủy'}
                </span>
              </div>
            </div>

            <div className={`${className}__appointment-actions`}>
              {appointment.status === 'scheduled' && (
                <>
                  <button
                    onClick={() => updateAppointmentStatus(appointment.id, 'confirmed')}
                    className={`${className}__btn ${className}__btn--small ${className}__btn--success`}
                    disabled={isLoading}
                  >
                    Xác nhận
                  </button>
                  <button
                    onClick={() => startVideoCallFromAppointment(appointment)}
                    className={`${className}__btn ${className}__btn--small ${className}__btn--primary`}
                    disabled={isLoading}
                  >
                    Bắt đầu cuộc gọi
                  </button>
                </>
              )}

              {appointment.status === 'confirmed' && (
                <button
                  onClick={() => startVideoCallFromAppointment(appointment)}
                  className={`${className}__btn ${className}__btn--small ${className}__btn--primary`}
                  disabled={isLoading}
                >
                  Bắt đầu cuộc gọi
                </button>
              )}

              {appointment.status === 'in-progress' && (
                <button
                  onClick={() => updateAppointmentStatus(appointment.id, 'completed')}
                  className={`${className}__btn ${className}__btn--small ${className}__btn--success`}
                  disabled={isLoading}
                >
                  Hoàn thành
                </button>
              )}

              {(appointment.status === 'scheduled' || appointment.status === 'confirmed') && (
                <button
                  onClick={() => updateAppointmentStatus(appointment.id, 'cancelled')}
                  className={`${className}__btn ${className}__btn--small ${className}__btn--danger`}
                  disabled={isLoading}
                >
                  Hủy
                </button>
              )}

              <button
                onClick={() => deleteAppointment(appointment.id)}
                className={`${className}__btn ${className}__btn--small ${className}__btn--danger`}
                disabled={isLoading}
              >
                Xóa
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AppointmentManager;

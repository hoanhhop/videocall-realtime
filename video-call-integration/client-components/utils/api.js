import axios from 'axios';

/**
 * Cấu hình API client cho video call integration
 */
class VideoCallAPI {
  constructor(baseURL = 'https://34.142.175.163:3001/api') {
    this.baseURL = baseURL;
    this.token = localStorage.getItem('videoCallToken');
    
    // Tạo axios instance
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Request interceptor để thêm token
    this.client.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor để xử lý errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired hoặc invalid
          this.clearToken();
          window.location.href = '/login'; // Redirect đến trang login
        }
        return Promise.reject(error);
      }
    );
  }

  /**
   * Set authentication token
   * @param {string} token - JWT token
   */
  setToken(token) {
    this.token = token;
    localStorage.setItem('videoCallToken', token);
  }

  /**
   * Clear authentication token
   */
  clearToken() {
    this.token = null;
    localStorage.removeItem('videoCallToken');
  }

  /**
   * Đăng nhập người dùng
   * @param {string} email - Email
   * @param {string} password - Mật khẩu
   * @returns {Promise<Object>} User data và token
   */
  async login(email, password) {
    try {
      const response = await this.client.post('/auth/login', {
        email,
        password
      });
      
      if (response.data.success && response.data.token) {
        this.setToken(response.data.token);
      }
      
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Đăng xuất người dùng
   */
  async logout() {
    try {
      await this.client.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.clearToken();
    }
  }

  /**
   * Lấy thông tin profile người dùng
   * @returns {Promise<Object>} User profile
   */
  async getProfile() {
    try {
      const response = await this.client.get('/auth/profile');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Tạo video call session mới
   * @param {Object} callData - Dữ liệu cuộc gọi
   * @returns {Promise<Object>} Session data
   */
  async createVideoCall(callData) {
    try {
      const response = await this.client.post('/videocall/create', callData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Tham gia video call session
   * @param {string} sessionId - ID của session
   * @returns {Promise<Object>} Session data
   */
  async joinVideoCall(sessionId) {
    try {
      const response = await this.client.post(`/videocall/join/${sessionId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Kết thúc video call session
   * @param {string} sessionId - ID của session
   * @returns {Promise<Object>} Result
   */
  async endVideoCall(sessionId) {
    try {
      const response = await this.client.post(`/videocall/end/${sessionId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Lấy danh sách appointments
   * @returns {Promise<Object>} Appointments list
   */
  async getAppointments() {
    try {
      const response = await this.client.get('/appointments');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Tạo appointment mới
   * @param {Object} appointmentData - Dữ liệu appointment
   * @returns {Promise<Object>} Created appointment
   */
  async createAppointment(appointmentData) {
    try {
      const response = await this.client.post('/appointments', appointmentData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Cập nhật appointment
   * @param {string} appointmentId - ID của appointment
   * @param {Object} updateData - Dữ liệu cập nhật
   * @returns {Promise<Object>} Updated appointment
   */
  async updateAppointment(appointmentId, updateData) {
    try {
      const response = await this.client.put(`/appointments/${appointmentId}`, updateData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Xóa appointment
   * @param {string} appointmentId - ID của appointment
   * @returns {Promise<Object>} Result
   */
  async deleteAppointment(appointmentId) {
    try {
      const response = await this.client.delete(`/appointments/${appointmentId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Lấy danh sách notifications
   * @returns {Promise<Object>} Notifications list
   */
  async getNotifications() {
    try {
      const response = await this.client.get('/notifications');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Đánh dấu notification đã đọc
   * @param {string} notificationId - ID của notification
   * @returns {Promise<Object>} Result
   */
  async markNotificationAsRead(notificationId) {
    try {
      const response = await this.client.put(`/notifications/${notificationId}/read`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Lấy danh sách users online
   * @returns {Promise<Object>} Online users list
   */
  async getOnlineUsers() {
    try {
      const response = await this.client.get('/users/online');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  /**
   * Xử lý lỗi API
   * @param {Error} error - Error object
   * @returns {Error} Formatted error
   */
  handleError(error) {
    if (error.response) {
      // Server responded with error status
      const message = error.response.data?.message || error.response.statusText;
      return new Error(`API Error: ${message}`);
    } else if (error.request) {
      // Request was made but no response received
      return new Error('Không thể kết nối đến server. Vui lòng kiểm tra kết nối internet.');
    } else {
      // Something else happened
      return new Error(`Lỗi: ${error.message}`);
    }
  }
}

// Export singleton instance
export const videoCallAPI = new VideoCallAPI();
export default VideoCallAPI;

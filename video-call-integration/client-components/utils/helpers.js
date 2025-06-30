/**
 * Utility functions cho video call integration
 */

/**
 * Format thời gian duration
 * @param {number} seconds - Số giây
 * @returns {string} Formatted time (HH:MM:SS)
 */
export const formatDuration = (seconds) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Format datetime cho hiển thị
 * @param {string|Date} datetime - DateTime
 * @returns {string} Formatted datetime
 */
export const formatDateTime = (datetime) => {
  const date = new Date(datetime);
  return date.toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Format date cho hiển thị
 * @param {string|Date} date - Date
 * @returns {string} Formatted date
 */
export const formatDate = (date) => {
  const d = new Date(date);
  return d.toLocaleDateString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
};

/**
 * Format time cho hiển thị
 * @param {string|Date} time - Time
 * @returns {string} Formatted time
 */
export const formatTime = (time) => {
  const t = new Date(time);
  return t.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Kiểm tra xem có phải mobile device không
 * @returns {boolean} True nếu là mobile
 */
export const isMobileDevice = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

/**
 * Kiểm tra browser support cho WebRTC
 * @returns {Object} Support status
 */
export const checkWebRTCSupport = () => {
  const hasGetUserMedia = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  const hasRTCPeerConnection = !!(window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection);
  const hasWebSocket = !!window.WebSocket;

  return {
    supported: hasGetUserMedia && hasRTCPeerConnection && hasWebSocket,
    getUserMedia: hasGetUserMedia,
    peerConnection: hasRTCPeerConnection,
    webSocket: hasWebSocket
  };
};

/**
 * Generate unique ID
 * @returns {string} Unique ID
 */
export const generateId = () => {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
};

/**
 * Validate email format
 * @param {string} email - Email address
 * @returns {boolean} True nếu email hợp lệ
 */
export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise<boolean>} Success status
 */
export const copyToClipboard = async (text) => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      const result = document.execCommand('copy');
      textArea.remove();
      return result;
    }
  } catch (error) {
    console.error('Failed to copy text:', error);
    return false;
  }
};

/**
 * Get user's preferred language
 * @returns {string} Language code (vi, en, etc.)
 */
export const getUserLanguage = () => {
  return navigator.language || navigator.userLanguage || 'vi';
};

/**
 * Format file size
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Get connection quality based on stats
 * @param {Object} stats - WebRTC stats
 * @returns {string} Quality level (excellent, good, fair, poor)
 */
export const getConnectionQuality = (stats) => {
  if (!stats) return 'unknown';
  
  const { packetsLost = 0, packetsReceived = 0, currentRoundTripTime = 0 } = stats;
  
  const lossRate = packetsReceived > 0 ? (packetsLost / packetsReceived) * 100 : 0;
  const rtt = currentRoundTripTime * 1000; // Convert to ms
  
  if (lossRate < 1 && rtt < 100) return 'excellent';
  if (lossRate < 3 && rtt < 200) return 'good';
  if (lossRate < 5 && rtt < 400) return 'fair';
  return 'poor';
};

/**
 * Create notification
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {Object} options - Additional options
 * @returns {Promise<Notification>} Notification instance
 */
export const createNotification = async (title, body, options = {}) => {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return null;
  }

  if (Notification.permission === 'granted') {
    return new Notification(title, { body, ...options });
  } else if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      return new Notification(title, { body, ...options });
    }
  }
  
  return null;
};

/**
 * Handle errors với user-friendly messages
 * @param {Error} error - Error object
 * @returns {string} User-friendly error message
 */
export const handleError = (error) => {
  console.error('Error:', error);
  
  if (error.name === 'NotAllowedError') {
    return 'Bạn cần cấp quyền truy cập camera và microphone để sử dụng tính năng này.';
  } else if (error.name === 'NotFoundError') {
    return 'Không tìm thấy camera hoặc microphone. Vui lòng kiểm tra thiết bị.';
  } else if (error.name === 'NotReadableError') {
    return 'Camera hoặc microphone đang được sử dụng bởi ứng dụng khác.';
  } else if (error.name === 'OverconstrainedError') {
    return 'Thiết bị không hỗ trợ cấu hình yêu cầu.';
  } else if (error.message && error.message.includes('network')) {
    return 'Lỗi kết nối mạng. Vui lòng kiểm tra internet.';
  } else if (error.message && error.message.includes('server')) {
    return 'Lỗi server. Vui lòng thử lại sau.';
  }
  
  return error.message || 'Đã xảy ra lỗi không xác định.';
};

/**
 * Local storage helpers
 */
export const storage = {
  set: (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  },
  
  get: (key, defaultValue = null) => {
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error('Failed to get from localStorage:', error);
      return defaultValue;
    }
  },
  
  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      console.error('Failed to remove from localStorage:', error);
    }
  },
  
  clear: () => {
    try {
      localStorage.clear();
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }
};

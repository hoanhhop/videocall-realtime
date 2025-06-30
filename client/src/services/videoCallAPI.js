// services/videoCallAPI.js - API service for video call integration
class VideoCallAPI {
  constructor(baseURL, authToken = null) {
    this.baseURL = baseURL;
    this.authToken = authToken;
  }

  // Helper method to make API requests
  async makeRequest(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw error;
    }
  }

  // Validate user with video call server
  async validateUser(userData) {
    return this.makeRequest('/api/auth/validate', {
      method: 'POST',
      body: JSON.stringify({
        id: userData.id,
        username: userData.username,
        email: userData.email,
        avatar: userData.avatar
      })
    });
  }

  // Register user for video calling
  async registerUser(userData) {
    return this.makeRequest('/api/auth/register-external', {
      method: 'POST',
      body: JSON.stringify({
        externalId: userData.id,
        username: userData.username,
        email: userData.email,
        avatar: userData.avatar,
        source: 'external_website'
      })
    });
  }

  // Get list of online users
  async getOnlineUsers() {
    const response = await this.makeRequest('/api/users/online');
    return response.users || [];
  }

  // Initiate a call
  async initiateCall(targetUserId, roomId) {
    return this.makeRequest('/api/calls/initiate', {
      method: 'POST',
      body: JSON.stringify({
        targetUserId,
        roomId
      })
    });
  }

  // Accept a call
  async acceptCall(callId) {
    return this.makeRequest(`/api/calls/${callId}/accept`, {
      method: 'POST'
    });
  }

  // Reject a call
  async rejectCall(callId) {
    return this.makeRequest(`/api/calls/${callId}/reject`, {
      method: 'POST'
    });
  }

  // End a call
  async endCall(callId) {
    return this.makeRequest(`/api/calls/${callId}/end`, {
      method: 'POST'
    });
  }

  // Get call history for user
  async getCallHistory(userId, limit = 20) {
    return this.makeRequest(`/api/calls/history/${userId}?limit=${limit}`);
  }

  // Get active calls for user
  async getActiveCalls() {
    return this.makeRequest('/api/calls/active');
  }

  // Check server health
  async checkHealth() {
    try {
      return await this.makeRequest('/api/health');
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  // Update user status
  async updateUserStatus(status) {
    return this.makeRequest('/api/users/status', {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  }

  // Get user by ID
  async getUserById(userId) {
    return this.makeRequest(`/api/users/${userId}`);
  }

  // Search users for calling
  async searchUsers(query) {
    return this.makeRequest(`/api/users/search?q=${encodeURIComponent(query)}`);
  }
}

export default VideoCallAPI;

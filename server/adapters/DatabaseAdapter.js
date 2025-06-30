const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

/**
 * Database Adapter for existing MySQL database with taikhoan table
 * Tích hợp với database MySQL hiện có sử dụng bảng taikhoan
 */
class DatabaseAdapter {
  constructor() {
    this.dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'hommy_database',
      charset: 'utf8mb4'
    };
  }

  async getConnection() {
    return await mysql.createConnection(this.dbConfig);
  }

  // ==================== USER MANAGEMENT ====================
  
  /**
   * Lấy thông tin user từ bảng taikhoan
   */
  async getUserById(userId) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
          Id as id,
          maTK as userCode,
          tenTK as fullName,
          email,
          soDienThoai as phone,
          ngaySinh as birthDate,
          gioiTinh as gender,
          avatar,
          trangThai as status
        FROM taikhoan 
        WHERE Id = ? AND trangThai = 1`,
        [userId]
      );
      return rows[0] || null;
    } finally {
      await connection.end();
    }
  }

  /**
   * Lấy user theo email hoặc mã tài khoản
   */
  async getUserByCredential(credential) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
          Id as id,
          maTK as userCode,
          tenTK as fullName,
          email,
          matKhau as password,
          soDienThoai as phone,
          avatar,
          trangThai as status
        FROM taikhoan 
        WHERE (email = ? OR maTK = ?) AND trangThai = 1`,
        [credential, credential]
      );
      return rows[0] || null;
    } finally {
      await connection.end();
    }
  }

  /**
   * Xác thực user với password
   */
  async authenticateUser(credential, password) {
    const user = await this.getUserByCredential(credential);
    if (!user) return null;

    // Kiểm tra password (giả sử đã hash bằng bcrypt)
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return null;

    // Không trả về password
    delete user.password;
    return user;
  }

  /**
   * Lấy danh sách users để gọi video call
   */
  async getAvailableUsers(currentUserId) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
          t.Id as id,
          t.maTK as userCode,
          t.tenTK as fullName,
          t.email,
          t.avatar,
          COALESCE(uo.is_online, 0) as isOnline,
          uo.last_seen as lastSeen
        FROM taikhoan t
        LEFT JOIN user_online_status uo ON t.Id = uo.user_id
        WHERE t.Id != ? AND t.trangThai = 1
        ORDER BY uo.is_online DESC, t.tenTK ASC`,
        [currentUserId]
      );
      return rows;
    } finally {
      await connection.end();
    }
  }

  // ==================== VIDEO CALL SESSIONS ====================

  /**
   * Tạo session video call mới
   */
  async createVideoCallSession(callerId, calleeId, roomId) {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute(
        `INSERT INTO video_call_sessions 
        (caller_id, callee_id, room_id, status, started_at) 
        VALUES (?, ?, ?, 'pending', NOW())`,
        [callerId, calleeId, roomId]
      );
      return result.insertId;
    } finally {
      await connection.end();
    }
  }

  /**
   * Cập nhật trạng thái video call session
   */
  async updateVideoCallSession(sessionId, status, endedAt = null) {
    const connection = await this.getConnection();
    try {
      let query = 'UPDATE video_call_sessions SET status = ?';
      const params = [status];
      
      if (endedAt) {
        query += ', ended_at = ?';
        params.push(endedAt);
      }
      
      if (status === 'ended' && !endedAt) {
        query += ', ended_at = NOW()';
      }
      
      query += ' WHERE id = ?';
      params.push(sessionId);

      await connection.execute(query, params);
      return true;
    } finally {
      await connection.end();
    }
  }

  /**
   * Lấy thông tin video call session
   */
  async getVideoCallSession(sessionId) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
          vcs.*,
          caller.tenTK as callerName,
          caller.avatar as callerAvatar,
          callee.tenTK as calleeName,
          callee.avatar as calleeAvatar
        FROM video_call_sessions vcs
        JOIN taikhoan caller ON vcs.caller_id = caller.Id
        JOIN taikhoan callee ON vcs.callee_id = callee.Id
        WHERE vcs.id = ?`,
        [sessionId]
      );
      return rows[0] || null;
    } finally {
      await connection.end();
    }
  }

  /**
   * Lấy session theo room_id
   */
  async getVideoCallSessionByRoomId(roomId) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
          vcs.*,
          caller.tenTK as callerName,
          caller.avatar as callerAvatar,
          callee.tenTK as calleeName,
          callee.avatar as calleeAvatar
        FROM video_call_sessions vcs
        JOIN taikhoan caller ON vcs.caller_id = caller.Id
        JOIN taikhoan callee ON vcs.callee_id = callee.Id
        WHERE vcs.room_id = ?`,
        [roomId]
      );
      return rows[0] || null;
    } finally {
      await connection.end();
    }
  }

  // ==================== USER ONLINE STATUS ====================

  /**
   * Cập nhật trạng thái online của user
   */
  async updateUserOnlineStatus(userId, isOnline, socketId = null) {
    const connection = await this.getConnection();
    try {
      await connection.execute(
        `INSERT INTO user_online_status (user_id, is_online, last_seen, socket_id)
        VALUES (?, ?, NOW(), ?)
        ON DUPLICATE KEY UPDATE 
        is_online = VALUES(is_online),
        last_seen = VALUES(last_seen),
        socket_id = VALUES(socket_id)`,
        [userId, isOnline, socketId]
      );
      return true;
    } finally {
      await connection.end();
    }
  }

  /**
   * Lấy trạng thái online của user
   */
  async getUserOnlineStatus(userId) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        'SELECT * FROM user_online_status WHERE user_id = ?',
        [userId]
      );
      return rows[0] || null;
    } finally {
      await connection.end();
    }
  }

  // ==================== NOTIFICATIONS ====================

  /**
   * Tạo notification cho user
   */
  async createNotification(userId, type, data) {
    const connection = await this.getConnection();
    try {
      const [result] = await connection.execute(
        `INSERT INTO call_notifications (user_id, type, data, created_at)
        VALUES (?, ?, ?, NOW())`,
        [userId, type, JSON.stringify(data)]
      );
      return result.insertId;
    } finally {
      await connection.end();
    }
  }

  /**
   * Lấy notifications chưa đọc của user
   */
  async getUnreadNotifications(userId) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT * FROM call_notifications 
        WHERE user_id = ? AND is_read = FALSE 
        ORDER BY created_at DESC`,
        [userId]
      );
      return rows.map(row => ({
        ...row,
        data: JSON.parse(row.data)
      }));
    } finally {
      await connection.end();
    }
  }

  /**
   * Đánh dấu notification đã đọc
   */
  async markNotificationAsRead(notificationId) {
    const connection = await this.getConnection();
    try {
      await connection.execute(
        'UPDATE call_notifications SET is_read = TRUE WHERE id = ?',
        [notificationId]
      );
      return true;
    } finally {
      await connection.end();
    }
  }

  // ==================== APPOINTMENT INTEGRATION ====================

  /**
   * Lấy cuộc hẹn từ bảng cuochen (nếu cần tích hợp với lịch hẹn)
   */
  async getAppointmentById(appointmentId) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
          c.*,
          patient.tenTK as patientName,
          doctor.tenTK as doctorName
        FROM cuochen c
        LEFT JOIN taikhoan patient ON c.patient_id = patient.Id
        LEFT JOIN taikhoan doctor ON c.doctor_id = doctor.Id
        WHERE c.id = ?`,
        [appointmentId]
      );
      return rows[0] || null;
    } finally {
      await connection.end();
    }
  }

  /**
   * Lấy cuộc hẹn sắp tới của user
   */
  async getUpcomingAppointments(userId) {
    const connection = await this.getConnection();
    try {
      const [rows] = await connection.execute(
        `SELECT 
          c.*,
          CASE 
            WHEN c.patient_id = ? THEN doctor.tenTK
            ELSE patient.tenTK
          END as otherPartyName,
          CASE 
            WHEN c.patient_id = ? THEN c.doctor_id
            ELSE c.patient_id
          END as otherPartyId
        FROM cuochen c
        LEFT JOIN taikhoan patient ON c.patient_id = patient.Id
        LEFT JOIN taikhoan doctor ON c.doctor_id = doctor.Id
        WHERE (c.patient_id = ? OR c.doctor_id = ?)
        AND c.appointment_time > NOW()
        AND c.status = 'confirmed'
        ORDER BY c.appointment_time ASC`,
        [userId, userId, userId, userId]
      );
      return rows;
    } finally {
      await connection.end();
    }
  }
}

module.exports = DatabaseAdapter;

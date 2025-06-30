// server/controllers/externalAuthController.js - Authentication for external website integration
const mysql = require('mysql2/promise');
const jwt = require('jsonwebtoken');
const { createLogger } = require('../utils/logger');

const logger = createLogger('external-auth-controller');

// Database configuration - should be in environment variables
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'your_database',
  port: process.env.DB_PORT || 3306
};

// Online users storage (in production, use Redis or database)
const onlineUsers = new Map();

const externalAuthController = {
  /**
   * Validate user from external website
   */
  async validateUser(req, res) {
    try {
      const { id, username, email, avatar } = req.body;

      if (!id || !username || !email) {
        return res.status(400).json({
          success: false,
          message: 'Missing required user data'
        });
      }

      const connection = await mysql.createConnection(dbConfig);

      try {
        // Check if user exists in video_call_users table
        const [existingUsers] = await connection.execute(
          'SELECT * FROM video_call_users WHERE external_user_id = ?',
          [id]
        );

        let videoCallUser;

        if (existingUsers.length === 0) {
          // Create new video call user record
          const [result] = await connection.execute(
            `INSERT INTO video_call_users (external_user_id, username, email, avatar, created_at) 
             VALUES (?, ?, ?, ?, NOW())`,
            [id, username, email, avatar]
          );

          videoCallUser = {
            id: result.insertId,
            external_user_id: id,
            username,
            email,
            avatar
          };
        } else {
          // Update existing user data
          await connection.execute(
            'UPDATE video_call_users SET username = ?, email = ?, avatar = ?, updated_at = NOW() WHERE external_user_id = ?',
            [username, email, avatar, id]
          );

          videoCallUser = existingUsers[0];
        }

        // Generate JWT token for video call session
        const token = jwt.sign(
          { 
            userId: videoCallUser.id,
            externalUserId: id,
            username 
          },
          process.env.JWT_SECRET || 'your-secret-key',
          { expiresIn: '24h' }
        );

        await connection.end();

        res.json({
          success: true,
          user: {
            id: videoCallUser.id,
            externalId: id,
            username,
            email,
            avatar
          },
          token
        });

      } catch (dbError) {
        await connection.end();
        throw dbError;
      }

    } catch (error) {
      logger.error('Error validating user:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        details: error.message
      });
    }
  },

  /**
   * Register user for external integration
   */
  async registerExternal(req, res) {
    try {
      const { externalId, username, email, avatar, source } = req.body;

      const connection = await mysql.createConnection(dbConfig);

      try {
        // Insert or update user
        const [result] = await connection.execute(
          `INSERT INTO video_call_users (external_user_id, username, email, avatar, source, created_at) 
           VALUES (?, ?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE 
           username = VALUES(username),
           email = VALUES(email),
           avatar = VALUES(avatar),
           updated_at = NOW()`,
          [externalId, username, email, avatar, source || 'external_website']
        );

        await connection.end();

        res.json({
          success: true,
          message: 'User registered successfully',
          userId: result.insertId
        });

      } catch (dbError) {
        await connection.end();
        throw dbError;
      }

    } catch (error) {
      logger.error('Error registering external user:', error);
      res.status(500).json({
        success: false,
        message: 'Registration failed',
        details: error.message
      });
    }
  },

  /**
   * Get online users for video calling
   */
  async getOnlineUsers(req, res) {
    try {
      const connection = await mysql.createConnection(dbConfig);

      try {
        const [users] = await connection.execute(
          `SELECT vcu.id, vcu.external_user_id, vcu.username, vcu.avatar, uos.last_seen
           FROM video_call_users vcu
           JOIN user_online_status uos ON vcu.id = uos.user_id
           WHERE uos.is_online = TRUE
           ORDER BY uos.last_seen DESC`
        );

        await connection.end();

        res.json({
          success: true,
          users: users.map(user => ({
            id: user.id,
            externalId: user.external_user_id,
            username: user.username,
            avatar: user.avatar,
            lastSeen: user.last_seen
          }))
        });

      } catch (dbError) {
        await connection.end();
        throw dbError;
      }

    } catch (error) {
      logger.error('Error getting online users:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get online users',
        details: error.message
      });
    }
  },

  /**
   * Set user online status
   */
  async setUserOnline(userId, socketId) {
    try {
      const connection = await mysql.createConnection(dbConfig);

      await connection.execute(
        `INSERT INTO user_online_status (user_id, is_online, socket_id, last_seen) 
         VALUES (?, TRUE, ?, NOW())
         ON DUPLICATE KEY UPDATE 
         is_online = TRUE, 
         socket_id = VALUES(socket_id), 
         last_seen = NOW()`,
        [userId, socketId]
      );

      await connection.end();
      onlineUsers.set(userId, { socketId, timestamp: Date.now() });

      logger.info(`User ${userId} set online with socket ${socketId}`);
      return true;

    } catch (error) {
      logger.error('Error setting user online:', error);
      return false;
    }
  },

  /**
   * Set user offline
   */
  async setUserOffline(userId) {
    try {
      const connection = await mysql.createConnection(dbConfig);

      await connection.execute(
        'UPDATE user_online_status SET is_online = FALSE, last_seen = NOW() WHERE user_id = ?',
        [userId]
      );

      await connection.end();
      onlineUsers.delete(userId);

      logger.info(`User ${userId} set offline`);
      return true;

    } catch (error) {
      logger.error('Error setting user offline:', error);
      return false;
    }
  },

  /**
   * Get user by ID
   */
  async getUserById(userId) {
    try {
      const connection = await mysql.createConnection(dbConfig);

      const [users] = await connection.execute(
        'SELECT id, external_user_id, username, email, avatar FROM video_call_users WHERE id = ?',
        [userId]
      );

      await connection.end();
      return users[0] || null;

    } catch (error) {
      logger.error('Error getting user by ID:', error);
      return null;
    }
  },

  /**
   * Search users for calling
   */
  async searchUsers(req, res) {
    try {
      const { q: query } = req.query;
      const currentUserId = req.user?.userId;

      if (!query) {
        return res.status(400).json({
          success: false,
          message: 'Search query required'
        });
      }

      const connection = await mysql.createConnection(dbConfig);

      try {
        const [users] = await connection.execute(
          `SELECT vcu.id, vcu.external_user_id, vcu.username, vcu.avatar
           FROM video_call_users vcu
           WHERE vcu.username LIKE ? AND vcu.id != ?
           LIMIT 20`,
          [`%${query}%`, currentUserId || 0]
        );

        await connection.end();

        res.json({
          success: true,
          users: users.map(user => ({
            id: user.id,
            externalId: user.external_user_id,
            username: user.username,
            avatar: user.avatar
          }))
        });

      } catch (dbError) {
        await connection.end();
        throw dbError;
      }

    } catch (error) {
      logger.error('Error searching users:', error);
      res.status(500).json({
        success: false,
        message: 'Search failed',
        details: error.message
      });
    }
  },

  /**
   * Middleware to authenticate JWT token
   */
  authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, decoded) => {
      if (err) {
        return res.status(403).json({
          success: false,
          message: 'Invalid or expired token'
        });
      }

      req.user = decoded;
      next();
    });
  }
};

module.exports = {
  externalAuthController,
  setUserOnline: externalAuthController.setUserOnline,
  setUserOffline: externalAuthController.setUserOffline,
  getUserById: externalAuthController.getUserById
};

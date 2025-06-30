// server/controllers/authController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { createLogger } = require('../utils/logger');

const logger = createLogger('auth-controller');

// In-memory user storage (trong production nên dùng database)
const users = new Map();
const onlineUsers = new Map();

const authController = {
  async register(req, res) {
    try {
      const { username, email, password } = req.body;

      // Validation
      if (!username || !email || !password) {
        return res.status(400).json({ 
          message: 'Username, email, and password are required' 
        });
      }

      if (password.length < 6) {
        return res.status(400).json({ 
          message: 'Password must be at least 6 characters long' 
        });
      }

      // Check if user already exists
      const existingUser = Array.from(users.values()).find(
        user => user.username === username || user.email === email
      );

      if (existingUser) {
        return res.status(400).json({ 
          message: 'Username or email already exists' 
        });
      }

      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);

      // Create user
      const userId = Date.now().toString() + Math.random().toString(36).substring(2, 5);
      const user = {
        id: userId,
        username,
        email,
        password: hashedPassword,
        createdAt: new Date(),
        avatar: `/api/avatar/${username}`, // Auto-generated avatar
        language: 'vi', // Default language
        status: 'offline'
      };

      users.set(userId, user);
      logger.info(`User registered: ${username} (${userId})`);

      res.status(201).json({ 
        message: 'User registered successfully',
        userId 
      });

    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({ 
        message: 'Internal server error' 
      });
    }
  },

  async login(req, res) {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ 
          message: 'Username and password are required' 
        });
      }

      // Find user
      const user = Array.from(users.values()).find(
        u => u.username === username || u.email === username
      );

      if (!user) {
        return res.status(401).json({ 
          message: 'Invalid credentials' 
        });
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        return res.status(401).json({ 
          message: 'Invalid credentials' 
        });
      }

      // Generate JWT token
      const token = jwt.sign(
        { userId: user.id, username: user.username },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '24h' }
      );

      // Update user status
      user.status = 'online';
      user.lastLoginAt = new Date();

      // Return user data (without password)
      const userResponse = {
        id: user.id,
        username: user.username,
        email: user.email,
        avatar: user.avatar,
        language: user.language,
        status: user.status
      };

      logger.info(`User logged in: ${username} (${user.id})`);

      res.json({
        message: 'Login successful',
        user: userResponse,
        token
      });

    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ 
        message: 'Internal server error' 
      });
    }
  },

  async logout(req, res) {
    try {
      const { userId } = req.body;
      
      if (userId && users.has(userId)) {
        const user = users.get(userId);
        user.status = 'offline';
        user.lastSeenAt = new Date();
        
        onlineUsers.delete(userId);
        logger.info(`User logged out: ${user.username} (${userId})`);
      }

      res.json({ message: 'Logout successful' });
    } catch (error) {
      logger.error('Logout error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // Get all users (for development - trong production nên phân trang)
  getAllUsers(req, res) {
    try {
      const userList = Array.from(users.values()).map(user => ({
        id: user.id,
        username: user.username,
        avatar: user.avatar,
        status: user.status,
        language: user.language,
        lastSeen: user.lastSeenAt
      }));

      res.json({ users: userList });
    } catch (error) {
      logger.error('Get users error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  },

  // Avatar generation endpoint
  generateAvatar(req, res) {
    const { username } = req.params;
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
    const color = colors[username.length % colors.length];
    
    const svg = `
      <svg width="80" height="80" xmlns="http://www.w3.org/2000/svg">
        <circle cx="40" cy="40" r="40" fill="${color}"/>
        <text x="40" y="50" font-family="Arial" font-size="24" font-weight="bold" 
              text-anchor="middle" fill="white">
          ${username.charAt(0).toUpperCase()}
        </text>
      </svg>
    `;
    
    res.setHeader('Content-Type', 'image/svg+xml');
    res.send(svg);
  }
};

// Helper functions for socket integration
const getUserById = (userId) => users.get(userId);
const setUserOnline = (userId) => {
  if (users.has(userId)) {
    const user = users.get(userId);
    user.status = 'online';
    onlineUsers.set(userId, user);
    return user;
  }
  return null;
};

const setUserOffline = (userId) => {
  if (users.has(userId)) {
    const user = users.get(userId);
    user.status = 'offline';
    user.lastSeenAt = new Date();
    onlineUsers.delete(userId);
    return user;
  }
  return null;
};

const getOnlineUsers = () => Array.from(onlineUsers.values());

module.exports = {
  authController,
  getUserById,
  setUserOnline,
  setUserOffline,
  getOnlineUsers
};

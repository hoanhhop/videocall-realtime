const express = require('express');
const IntegrationController = require('../controllers/integrationController');
const AuthMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
const controller = new IntegrationController();
const auth = new AuthMiddleware();

// ==================== PUBLIC ROUTES ====================

/**
 * Authentication
 * POST /api/integration/auth
 */
router.post('/auth', 
  auth.corsHandler,
  auth.validateRequest(['credential', 'password']),
  controller.authenticate.bind(controller)
);

/**
 * Verify token
 * POST /api/integration/verify-token
 */
router.post('/verify-token',
  auth.corsHandler,
  auth.validateRequest(['token']),
  controller.verifyToken.bind(controller)
);

/**
 * Health check
 * GET /api/integration/health
 */
router.get('/health',
  auth.corsHandler,
  controller.healthCheck.bind(controller)
);

// ==================== PROTECTED ROUTES ====================

/**
 * Get available users for video call
 * GET /api/integration/users/available
 */
router.get('/users/available',
  auth.corsHandler,
  auth.verifyToken.bind(auth),
  controller.getAvailableUsers.bind(controller)
);

/**
 * Get current user profile
 * GET /api/integration/user/profile
 */
router.get('/user/profile',
  auth.corsHandler,
  auth.verifyToken.bind(auth),
  controller.getUserProfile.bind(controller)
);

// ==================== VIDEO CALL ROUTES ====================

/**
 * Initiate video call
 * POST /api/integration/video-call/initiate
 */
router.post('/video-call/initiate',
  auth.corsHandler,
  auth.verifyToken.bind(auth),
  auth.validateRequest(['calleeId']),
  controller.initiateVideoCall.bind(controller)
);

/**
 * Get video call session info
 * GET /api/integration/video-call/session/:sessionId
 */
router.get('/video-call/session/:sessionId',
  auth.corsHandler,
  auth.verifyToken.bind(auth),
  controller.getVideoCallSession.bind(controller)
);

/**
 * Update video call status
 * PUT /api/integration/video-call/session/:sessionId/status
 */
router.put('/video-call/session/:sessionId/status',
  auth.corsHandler,
  auth.verifyToken.bind(auth),
  auth.validateRequest(['status']),
  controller.updateVideoCallStatus.bind(controller)
);

// ==================== NOTIFICATION ROUTES ====================

/**
 * Get unread notifications
 * GET /api/integration/notifications/unread
 */
router.get('/notifications/unread',
  auth.corsHandler,
  auth.verifyToken.bind(auth),
  controller.getUnreadNotifications.bind(controller)
);

/**
 * Mark notification as read
 * PUT /api/integration/notifications/:notificationId/read
 */
router.put('/notifications/:notificationId/read',
  auth.corsHandler,
  auth.verifyToken.bind(auth),
  controller.markNotificationAsRead.bind(controller)
);

// ==================== APPOINTMENT ROUTES ====================

/**
 * Get upcoming appointments (từ bảng cuochen)
 * GET /api/integration/appointments/upcoming
 */
router.get('/appointments/upcoming',
  auth.corsHandler,
  auth.verifyToken.bind(auth),
  controller.getUpcomingAppointments.bind(controller)
);

// ==================== ERROR HANDLING ====================

// 404 handler
router.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint không tồn tại'
  });
});

// Error handler
router.use(auth.errorHandler.bind(auth));

module.exports = router;

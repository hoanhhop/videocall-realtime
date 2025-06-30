const express = require('express');
const IntegrationController = require('../controllers/integrationController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
const integrationController = new IntegrationController();

// ==================== PUBLIC ROUTES ====================

/**
 * External authentication
 * POST /api/integration/auth
 */
router.post('/auth', async (req, res) => {
  await integrationController.authenticate(req, res);
});

/**
 * Verify token từ website hiện có
 * POST /api/integration/verify-token
 */
router.post('/verify-token', async (req, res) => {
  await integrationController.verifyToken(req, res);
});

// ==================== PROTECTED ROUTES ====================

// Apply authentication middleware cho tất cả routes dưới đây
router.use(authMiddleware.authenticate);

/**
 * Lấy danh sách users có thể gọi video call
 * GET /api/integration/users/available
 */
router.get('/users/available', async (req, res) => {
  await integrationController.getAvailableUsers(req, res);
});

/**
 * Khởi tạo video call
 * POST /api/integration/video-call/initiate
 */
router.post('/video-call/initiate', async (req, res) => {
  await integrationController.initiateVideoCall(req, res);
});

/**
 * Join video call room
 * POST /api/integration/video-call/join
 */
router.post('/video-call/join', async (req, res) => {
  await integrationController.joinVideoCall(req, res);
});

/**
 * End video call
 * POST /api/integration/video-call/end
 */
router.post('/video-call/end', async (req, res) => {
  await integrationController.endVideoCall(req, res);
});

/**
 * Lấy notifications của user
 * GET /api/integration/notifications
 */
router.get('/notifications', async (req, res) => {
  await integrationController.getNotifications(req, res);
});

/**
 * Đánh dấu notification đã đọc
 * POST /api/integration/notifications/:id/read
 */
router.post('/notifications/:id/read', async (req, res) => {
  await integrationController.markNotificationAsRead(req, res);
});

/**
 * Lấy lịch hẹn sắp tới (tích hợp với bảng cuochen)
 * GET /api/integration/appointments/upcoming
 */
router.get('/appointments/upcoming', async (req, res) => {
  await integrationController.getUpcomingAppointments(req, res);
});

module.exports = router;

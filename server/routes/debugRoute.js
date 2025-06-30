// server/routes/debugRoute.js
const express = require('express');
const router = express.Router();

// Route chính để kiểm tra API hoạt động
router.get('/', (req, res) => {
  res.json({
    message: 'API is working',
    timestamp: new Date().toISOString(),
    routes: 'Use /api/debug/routes to see all available routes'
  });
});

// Route liệt kê tất cả endpoints có sẵn
router.get('/routes', (req, res) => {
  const routes = [];
  
  // Lấy tất cả routes từ Express router
  req.app._router.stack.forEach(middleware => {
    if (middleware.route) {
      // Route đăng ký trực tiếp
      routes.push({
        path: middleware.route.path,
        methods: Object.keys(middleware.route.methods)
      });
    } else if (middleware.name === 'router') {
      // Router đăng ký
      middleware.handle.stack.forEach(handler => {
        if (handler.route) {
          routes.push({
            path: middleware.path + handler.route.path,
            methods: Object.keys(handler.route.methods)
          });
        }
      });
    }
  });
  
  res.json({
    routes,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
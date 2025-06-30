// server/routes/apiRoutes.js
const express = require('express');
const router = express.Router();
const { upload, processContextFile } = require('../middleware/fileUpload');
const axios = require('axios');

// Controllers
const userController = require('../controllers/userController');
const translationController = require('../controllers/translationController');
const apisController = require('../controllers/apisController');
const healthController = require('../controllers/healthController');
const contextController = require('../controllers/contextController');
const ttsController = require('../controllers/ttsController');
const authController = require('../controllers/authController');
const callController = require('../controllers/callController');
const { externalAuthController } = require('../controllers/externalAuthController');

// Services
const ttsService = require('../services/ttsService');

// External integration authentication routes (for website integration)
router.post('/auth/validate', express.json(), externalAuthController.validateUser);
router.post('/auth/register-external', express.json(), externalAuthController.registerExternal);
router.get('/users/online', externalAuthController.authenticateToken, externalAuthController.getOnlineUsers);
router.get('/users/search', externalAuthController.authenticateToken, externalAuthController.searchUsers);
router.get('/users/:userId', externalAuthController.authenticateToken, async (req, res) => {
  const user = await externalAuthController.getUserById(req.params.userId);
  if (user) {
    res.json({ success: true, user });
  } else {
    res.status(404).json({ success: false, message: 'User not found' });
  }
});

// Internal authentication routes (for standalone usage)
router.post('/auth/register', express.json(), authController.register);
router.post('/auth/login', express.json(), authController.login);
router.get('/auth/me', authController.authenticateToken, authController.getCurrentUser);
router.post('/auth/logout', authController.authenticateToken, authController.logout);

// Call management routes (works with both auth systems)
router.post('/calls/initiate', externalAuthController.authenticateToken, express.json(), callController.initiateCall);
router.post('/calls/:callId/accept', externalAuthController.authenticateToken, express.json(), callController.acceptCall);
router.post('/calls/:callId/reject', externalAuthController.authenticateToken, express.json(), callController.rejectCall);
router.post('/calls/:callId/end', externalAuthController.authenticateToken, express.json(), callController.endCall);
router.get('/calls/active', externalAuthController.authenticateToken, callController.getActiveCalls);
router.get('/calls/history/:userId', externalAuthController.authenticateToken, callController.getCallHistory);

// Speech recognition routes
router.post('/stt', upload.single('audio'), speechController.handleSpeechRecognition);
router.get('/stt/model-info', speechController.getModelInfo);

// Translation routes
router.post('/translate', express.json(), translationController.handleTranslation);
router.post('/context-translate', express.json(), translationController.handleContextTranslation);
router.get('/translate/model-info', translationController.getModelInfo);

// Context routes
router.post('/context-file', upload.single('file'), processContextFile, contextController.handleContextFile);
router.post('/context-text', express.json(), contextController.handleContextText);

// TTS routes
router.get('/tts', ttsController.handleTextToSpeech);
router.post('/tts', express.json(), ttsController.handleTextToSpeechPost);
router.get('/tts/check', ttsController.checkAvailability);

router.post('/tts/synthesize', async (req, res) => {
  try {
    const { text, language = 'vi' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }
    
    // Xử lý voice reference nếu có
    let options = {};
    
    if (req.files && req.files.reference_voice) {
      options.referenceVoice = req.files.reference_voice.data;
    } else if (req.body.speaker) {
      options.speaker = req.body.speaker;
    }
    
    // Gọi TTS service
    const audioBuffer = await ttsService.textToSpeech(text, language, options);
    
    // Gửi dữ liệu audio
    res.set('Content-Type', 'audio/wav');
    res.send(audioBuffer);
  } catch (error) {
    console.error('TTS API error:', error);
    res.status(500).json({ 
      error: 'TTS failed',
      details: error.message 
    });
  }
});

// Get available speakers
router.get('/tts/speakers', async (req, res) => {
  try {
    // Gọi API từ TTS service
    const response = await axios.get(`${process.env.TTS_SERVICE_URL || 'http://tts:5002'}/speakers`);
    
    if (response.data && response.data.speakers) {
      return res.json({ speakers: response.data.speakers });
    } else {
      return res.json({ speakers: [] });
    }
  } catch (error) {
    console.error('Error fetching speakers:', error);
    // Không muốn trả về lỗi cho client, nên trả về danh sách trống
    res.json({ 
      speakers: [],
      error: 'Failed to fetch speakers'
    });
  }
});

// Room management routes (if needed)
router.get('/rooms/:roomId', (req, res) => {
  // Room info endpoint
  const { roomId } = req.params;
  res.json({ 
    roomId,
    active: true,
    participants: 0, // This would be dynamic in a real implementation
    created: new Date().toISOString()
  });
});

module.exports = router;
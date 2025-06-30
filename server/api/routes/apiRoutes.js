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
const speechController = require('../controllers/speechController');
const uiController = require('../controllers/uiController'); // Thêm controller UI mới

// Services
const ttsService = require('../services/ttsService');

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
router.post('/context/upload', upload.single('file'), processContextFile, contextController.handleContextFile); // Alias cho endpoint mới
router.post('/context/text', express.json(), contextController.handleContextText); // Alias cho endpoint mới

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

// UI Control routes
router.post('/subtitles/toggle', express.json(), uiController.toggleSubtitles); // Endpoint mới
router.post('/tts/toggle', express.json(), uiController.toggleTTS); // Endpoint mới
router.get('/ui-state/:roomId', uiController.getUIState); // Endpoint lấy trạng thái UI

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
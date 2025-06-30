// server/services/tts/ttsService.js
// WARNING: This file is not used and is a duplicate of /services/ttsService.js
// See /services/README.md for details on the correct file to use
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const axios = require('axios');
const FormData = require('form-data');
const { createLogger } = require('../utils/logger');
const logger = createLogger('tts-service-duplicate');

const TTS_SERVICE_URL = process.env.TTS_SERVICE_URL || 'http://tts:5002';

const ttsService = {
  /**
   * Convert text to speech using advanced TTS service (viXTTS/XTTS-v2)
   * @param {string} text - Text to convert to speech
   * @param {string} language - Language code (vi, en)
   * @param {Object} options - Additional options
   * @param {Buffer} options.referenceVoice - Voice reference audio (optional)
   * @param {string} options.speaker - Speaker name for predefined voices
   * @returns {Promise<Buffer>} Audio buffer
   */
  textToSpeech: async (text, language = 'vi', options = {}) => {
    try {
      if (!text) {
        throw new Error('No text provided');
      }
      
      // Check if advanced TTS service is available
      const advancedTTSAvailable = await ttsService.isAdvancedTTSAvailable();
      
      if (advancedTTSAvailable) {
        return await ttsService.advancedTextToSpeech(text, language, options);
      } else {
        // Fallback to basic TTS
        return await ttsService.basicTextToSpeech(text, language);
      }
    } catch (error) {
      console.error('TTS error:', error);
      throw new Error(`Text-to-speech failed: ${error.message}`);
    }
  },
  
  /**
   * Advanced TTS using viXTTS/XTTS-v2
   */
  advancedTextToSpeech: async (text, language = 'vi', options = {}) => {
    try {
      const formData = new FormData();
      formData.append('text', text);
      formData.append('language', language);
      
      if (options.referenceVoice) {
        formData.append('reference_voice', options.referenceVoice, {
          filename: 'reference.wav',
          contentType: 'audio/wav'
        });
      } else if (options.speaker) {
        formData.append('speaker', options.speaker);
      }
      
      const response = await axios.post(`${TTS_SERVICE_URL}/synthesize`, formData, {
        responseType: 'arraybuffer',
        headers: {
          ...formData.getHeaders()
        }
      });
      
      return Buffer.from(response.data);
    } catch (error) {
      console.error('Advanced TTS error:', error);
      throw new Error(`Advanced TTS failed: ${error.message || 'Unknown error'}`);
    }
  },
  
  /**
   * Basic TTS using eSpeak-NG and MBROLA (fallback)
   */
  basicTextToSpeech: async (text, language = 'vi') => {
    const tempFile = path.join(os.tmpdir(), `tts-${Date.now()}.wav`);
    let voice = language === 'vi' ? 'vi' : 'en';
    
    // Use MBROLA voices if available for better quality
    // voice = language === 'vi' ? 'mb-vn1' : 'mb-en1';
    
    // Execute eSpeak-NG command
    await execAsync(`espeak-ng -v ${voice} -w ${tempFile} "${text}"`);
    
    // Read the generated audio file
    const audioBuffer = await fs.readFile(tempFile);
    
    // Clean up temp file
    await fs.unlink(tempFile).catch(() => {});
    
    return audioBuffer;
  },
  
  /**
   * Check if TTS system is available
   */
  checkAvailability: async () => {
    try {
      // First check if advanced TTS is available
      const advancedAvailable = await ttsService.isAdvancedTTSAvailable();
      
      if (advancedAvailable) {
        return { available: true, engine: 'viXTTS/XTTS-v2', advanced: true };
      }
      
      // Fallback to basic TTS check
      await execAsync('espeak-ng --version');
      return { available: true, engine: 'eSpeak-NG', advanced: false };
    } catch (error) {
      return { available: false, error: error.message };
    }
  },
  
  /**
   * Check if advanced TTS service is available
   */
  isAdvancedTTSAvailable: async () => {
    try {
      await axios.get(`${TTS_SERVICE_URL}/health`);
      return true;
    } catch (error) {
      return false;
    }
  }
};

module.exports = ttsService;
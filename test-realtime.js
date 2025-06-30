// Real-time transcription test script
const io = require('socket.io-client');
const fs = require('fs');

// Test configuration
const TEST_CONFIG = {
  serverUrl: 'http://34.142.175.163:4000',
  audioFormat: 'pcm_16k',
  sendMode: 'realtime'
};

console.log('🚀 Testing Real-Time Transcription System');
console.log('Server:', TEST_CONFIG.serverUrl);

// Connect to server
const socket = io(TEST_CONFIG.serverUrl, {
  transports: ['websocket'],
  autoConnect: true,
  forceNew: true
});

socket.on('connect', () => {
  console.log('✅ Connected to server:', socket.id);
  console.log('Starting real-time test...');
  
  // Start recognition with real-time mode
  socket.emit('start-recognition', { language: 'vi' });
  
  // Test real-time audio streaming
  testRealTimeAudio();
});

socket.on('transcription-result', (data) => {
  console.log('📝 Transcription Result:', {
    text: data.text,
    isRealTime: data.isRealTime,
    isFinal: data.isFinal,
    confidence: data.confidence,
    inferenceTime: data.inferenceTime
  });
});

socket.on('translation-result', (data) => {
  console.log('🔄 Translation Result:', {
    original: data.originalText,
    translated: data.translatedText,
    isRealTime: data.isRealTime,
    confidence: data.confidence
  });
});

socket.on('error', (error) => {
  console.error('❌ Socket error:', error);
});

// Simulate real-time audio streaming
async function testRealTimeAudio() {
  console.log('🎤 Starting real-time audio simulation...');
  
  // Create simple audio buffer for testing
  const createTestAudio = (frequency, duration) => {
    const sampleRate = 16000;
    const samples = Math.floor(sampleRate * duration);
    const buffer = Buffer.alloc(samples * 2);
    
    for (let i = 0; i < samples; i++) {
      const value = Math.floor(Math.sin(i * frequency * Math.PI * 2 / sampleRate) * 0.3 * 32767);
      buffer.writeInt16LE(value, i * 2);
    }
    
    return buffer;
  };
  
  // Send continuous audio chunks with real-time flag
  let chunkCount = 0;
  const interval = setInterval(() => {
    if (chunkCount >= 50) { // Test for 5 seconds (50 chunks * 100ms)
      clearInterval(interval);
      console.log('🏁 Real-time test completed');
      socket.emit('stop-recognition');
      setTimeout(() => process.exit(0), 2000);
      return;
    }
    
    // Create audio chunk
    const audioChunk = createTestAudio(440 + (chunkCount * 10), 0.1); // Varying frequency
    
    // Send with real-time mode enabled
    socket.emit('audio-stream', {
      audioData: Array.from(audioChunk),
      language: 'vi',
      continuousMode: true,
      realTimeMode: true,  // Enable real-time processing
      timestamp: Date.now()
    });
    
    chunkCount++;
    
    if (chunkCount % 10 === 0) {
      console.log(`📡 Sent ${chunkCount} real-time audio chunks`);
    }
  }, 100); // Send every 100ms for real-time streaming
}

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted');
  socket.disconnect();
  process.exit(0);
});

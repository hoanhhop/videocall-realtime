#!/usr/bin/env node

/**
 * Test script for real-time streaming performance
 * Tests the optimized speech recognition with streaming API
 */

const io = require('socket.io-client');

// Test configuration
const TEST_CONFIG = {
  serverUrl: 'http://localhost:3000',
  language: 'vi',
  testDuration: 10000, // 10 seconds
  chunkInterval: 100,   // Send chunk every 100ms (real-time)
  chunkSize: 1600,      // 0.1 second of audio at 16kHz
  sampleRate: 16000
};

console.log('🚀 Starting Real-time Streaming Performance Test...');
console.log(`📊 Configuration:
  - Server: ${TEST_CONFIG.serverUrl}
  - Language: ${TEST_CONFIG.language}
  - Test Duration: ${TEST_CONFIG.testDuration}ms
  - Chunk Interval: ${TEST_CONFIG.chunkInterval}ms
  - Chunk Size: ${TEST_CONFIG.chunkSize} bytes
`);

// Performance metrics
let metrics = {
  chunksSet: 0,
  responsesReceived: 0,
  totalLatency: 0,
  minLatency: Infinity,
  maxLatency: 0,
  startTime: null,
  endTime: null,
  streamingResults: 0,
  finalResults: 0
};

// Create socket connection
const socket = io(TEST_CONFIG.serverUrl, {
  transports: ['websocket'],
  forceNew: true
});

// Generate test audio data
function generateTestAudio(frequency, durationMs) {
  const samples = Math.floor(TEST_CONFIG.sampleRate * durationMs / 1000);
  const buffer = Buffer.alloc(samples * 2); // 16-bit PCM
  
  for (let i = 0; i < samples; i++) {
    const value = Math.floor(Math.sin(i * frequency * Math.PI * 2 / TEST_CONFIG.sampleRate) * 0.3 * 32767);
    buffer.writeInt16LE(value, i * 2);
  }
  
  return buffer;
}

// Socket event handlers
socket.on('connect', () => {
  console.log('✅ Socket connected:', socket.id);
  startStreamingTest();
});

socket.on('transcription-result', (data) => {
  const now = Date.now();
  const latency = now - data.timestamp;
  
  metrics.responsesReceived++;
  metrics.totalLatency += latency;
  metrics.minLatency = Math.min(metrics.minLatency, latency);
  metrics.maxLatency = Math.max(metrics.maxLatency, latency);
  
  if (data.isContinuous || data.isStreaming) {
    metrics.streamingResults++;
    console.log(`📡 [STREAMING] Result #${metrics.streamingResults}: "${data.text}" (latency: ${latency}ms)`);
  } else {
    metrics.finalResults++;
    console.log(`🎯 [FINAL] Result #${metrics.finalResults}: "${data.text}" (latency: ${latency}ms)`);
  }
});

socket.on('translation-result', (data) => {
  console.log(`🔄 [TRANSLATION]: "${data.originalText}" → "${data.translatedText}"`);
});

socket.on('transcription-error', (error) => {
  console.error('❌ Transcription error:', error);
});

socket.on('disconnect', () => {
  console.log('🔌 Socket disconnected');
});

// Main streaming test function
function startStreamingTest() {
  console.log('🎤 Starting streaming test...');
  metrics.startTime = Date.now();
  
  let chunkCount = 0;
  const interval = setInterval(() => {
    if (Date.now() - metrics.startTime >= TEST_CONFIG.testDuration) {
      clearInterval(interval);
      finishTest();
      return;
    }
    
    // Generate varying frequency audio to simulate speech
    const frequency = 200 + (chunkCount % 10) * 50; // Vary frequency
    const audioChunk = generateTestAudio(frequency, TEST_CONFIG.chunkInterval);
    
    // Send audio chunk with streaming parameters
    socket.emit('audio-stream', {
      audioData: Array.from(audioChunk),
      language: TEST_CONFIG.language,
      continuousMode: true,
      realTimeMode: true,
      timestamp: Date.now()
    });
    
    metrics.chunksSet++;
    chunkCount++;
    
    if (chunkCount % 20 === 0) {
      console.log(`📊 Sent ${chunkCount} chunks, received ${metrics.responsesReceived} responses`);
    }
    
  }, TEST_CONFIG.chunkInterval);
}

// Test completion and results
function finishTest() {
  metrics.endTime = Date.now();
  
  // Wait a bit for final responses
  setTimeout(() => {
    console.log('\n🏁 TEST COMPLETED - PERFORMANCE RESULTS');
    console.log('=' .repeat(50));
    
    const testDuration = metrics.endTime - metrics.startTime;
    const avgLatency = metrics.totalLatency / metrics.responsesReceived || 0;
    const responseRate = (metrics.responsesReceived / metrics.chunksSet * 100).toFixed(1);
    const throughput = (metrics.chunksSet / testDuration * 1000).toFixed(1);
    
    console.log(`📈 Test Duration: ${testDuration}ms`);
    console.log(`📦 Audio Chunks Sent: ${metrics.chunksSet}`);
    console.log(`📥 Responses Received: ${metrics.responsesReceived}`);
    console.log(`📊 Response Rate: ${responseRate}%`);
    console.log(`⚡ Throughput: ${throughput} chunks/sec`);
    console.log(`⏱️  Average Latency: ${avgLatency.toFixed(1)}ms`);
    console.log(`⏱️  Min Latency: ${metrics.minLatency === Infinity ? 'N/A' : metrics.minLatency}ms`);
    console.log(`⏱️  Max Latency: ${metrics.maxLatency}ms`);
    console.log(`🔄 Streaming Results: ${metrics.streamingResults}`);
    console.log(`🎯 Final Results: ${metrics.finalResults}`);
    
    // Performance assessment
    console.log('\n🎯 PERFORMANCE ASSESSMENT:');
    if (avgLatency < 200) {
      console.log('✅ EXCELLENT: Real-time performance achieved (< 200ms latency)');
    } else if (avgLatency < 500) {
      console.log('✅ GOOD: Near real-time performance (< 500ms latency)');
    } else if (avgLatency < 1000) {
      console.log('⚠️  ACCEPTABLE: Moderate latency (< 1s latency)');
    } else {
      console.log('❌ POOR: High latency (> 1s), needs optimization');
    }
    
    if (parseFloat(responseRate) > 80) {
      console.log('✅ HIGH: Good response rate (> 80%)');
    } else if (parseFloat(responseRate) > 50) {
      console.log('⚠️  MODERATE: Acceptable response rate (> 50%)');
    } else {
      console.log('❌ LOW: Poor response rate (< 50%), check connection');
    }
    
    console.log('\n🔧 RECOMMENDATIONS:');
    if (avgLatency > 300) {
      console.log('- Consider reducing buffer thresholds further');
      console.log('- Optimize ASR model parameters (beam_size, chunk_length)');
      console.log('- Check network latency between client and server');
    }
    
    if (metrics.streamingResults === 0) {
      console.log('- No streaming results received, check streaming API implementation');
      console.log('- Verify /recognize_stream endpoint is working');
    }
    
    process.exit(0);
  }, 2000);
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n⏹️  Test interrupted by user');
  finishTest();
});

console.log('⏳ Connecting to server...');

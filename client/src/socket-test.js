// Đây là script để test kết nối socket.io trực tiếp đến cổng 8081
// Chạy bằng Node.js: node socket-test.js

import { io } from 'socket.io-client';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

// Cấu hình test - thay đổi các giá trị này để thử nghiệm các trường hợp khác nhau
const TEST_CONFIG = {
  // Thay đổi giữa các định dạng để xác định định dạng nào hoạt động
  audioFormat: 'audio/webm', // Thử các giá trị: 'audio/wav', 'audio/webm', 'audio/mp3', 'audio/raw'
  
  // Thay đổi cách gửi dữ liệu audio
  sendMode: 'buffer', // Thử các giá trị: 'buffer', 'arrayBuffer', 'base64'
  
  // Cổng kết nối socket
  socketPort: 8081, // Thử: 8081 hoặc 5001 (cổng mà server socket thật đang chạy)
  
  // Thời gian giữa các lần gửi audio (ms)
  sendInterval: 1000,
  
  // Thời gian để server xử lý (ms)
  processingTimeout: 40000
};

// Kết nối đến socket server
console.log(`Đang kết nối đến socket server tại http://localhost:${TEST_CONFIG.socketPort}...`);
const socket = io(`http://localhost:${TEST_CONFIG.socketPort}`, {
  path: '/socket.io/',
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
  timeout: 60000,
  autoConnect: true,
  forceNew: true
});

// Ghi log ra file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logFile = path.join(__dirname, `socket-test-${new Date().toISOString().replace(/:/g, '-')}.log`);

function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp}: ${message}\n`;
  console.log(message);
  fs.appendFileSync(logFile, logMessage);
}

// Tạo audio buffer với tần số khác nhau để mô phỏng tiếng nói khác nhau
function createAudioBuffer(frequency, duration) {
  const sampleRate = 16000; // Giảm sample rate xuống 16kHz cho phù hợp với voice recognition
  const seconds = duration || 1;
  const channels = 1;
  const totalSamples = Math.floor(sampleRate * seconds);
  const buffer = Buffer.alloc(totalSamples * 2); // 2 bytes cho mỗi sample (16-bit)
  
  // Tạo sóng sin với tần số được chỉ định
  for (let i = 0; i < totalSamples; i++) {
    const value = Math.floor(Math.sin(i * frequency * Math.PI * 2 / sampleRate) * 0.5 * 32767);
    buffer.writeInt16LE(value, i * 2);
  }
  
  return buffer;
}

// Chuyển đổi buffer thành định dạng phù hợp để gửi
function prepareAudioData(buffer) {
  switch (TEST_CONFIG.sendMode) {
    case 'buffer':
      return buffer; // Gửi trực tiếp Buffer
      
    case 'arrayBuffer':
      return buffer.buffer.slice( // Chuyển đổi Buffer thành ArrayBuffer
        buffer.byteOffset,
        buffer.byteOffset + buffer.byteLength
      );
      
    case 'base64':
      return buffer.toString('base64'); // Chuyển đổi Buffer thành Base64 string
      
    default:
      return buffer;
  }
}

// Tạo một từ đơn giản với tiếng nói (A, E, I, O, U)
async function simulateWord() {
  // Mỗi nguyên âm có một tần số khác nhau
  const vowels = [
    { sound: 'A', freq: 440 },
    { sound: 'E', freq: 550 },
    { sound: 'I', freq: 660 },
    { sound: 'O', freq: 330 },
    { sound: 'U', freq: 220 }
  ];
  
  for (const vowel of vowels) {
    const buffer = createAudioBuffer(vowel.freq, 0.5);
    const audioData = prepareAudioData(buffer);
    
    log(`Gửi âm thanh nguyên âm ${vowel.sound} (${buffer.length} bytes) - Định dạng: ${TEST_CONFIG.audioFormat}`);
    
    socket.emit('audio-chunk', {
      audio: audioData,
      language: 'vi',
      format: TEST_CONFIG.audioFormat,
      sendMode: TEST_CONFIG.sendMode,
      timestamp: Date.now()
    });
    
    // Đợi một khoảng thời gian giữa các nguyên âm
    await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.sendInterval));
  }
}

// Tạo tần số tự nhiên hơn để mô phỏng tiếng nói thực tế
async function simulateRealSpeech() {
  try {
    // Các mẫu tiếng nói tốt hơn (tiếng nói con người có phổ tần số 85-255Hz)
    const naturalFreqs = [110, 150, 180, 220, 125];
    
    for (let i = 0; i < naturalFreqs.length; i++) {
      const freq = naturalFreqs[i];
      const buffer = createAudioBuffer(freq, 0.5); // Giảm thời lượng xuống 0.5 giây để tránh lỗi
      const audioData = prepareAudioData(buffer);
      
      log(`Gửi mẫu tiếng nói thực tế #${i+1} (${buffer.length} bytes) - Tần số: ${freq}Hz`);
      
      // Thử nhiều cách gửi khác nhau để xem cách nào hoạt động
      if (i % 2 === 0) {
        // Gửi kiểu 1: giống trình duyệt gửi audio-chunk
        socket.emit('audio-chunk', {
          audio: audioData,
          language: 'vi',
          format: TEST_CONFIG.audioFormat,
          hasSignificantAudio: true,
          timestamp: Date.now()
        });
      } else {
        // Gửi kiểu 2: gửi dưới dạng audio-stream
        socket.emit('audio-stream', { 
          audioData: Array.from(buffer), // Chuyển Buffer thành Array
          language: 'vi',
          hasSignificantAudio: true,
          timestamp: Date.now()
        });
      }
      
      // Đợi với thời gian cố định để tránh lỗi
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    log('Đã gửi tất cả dữ liệu mẫu tiếng nói thực tế');
  } catch (error) {
    log(`❌ Lỗi khi mô phỏng tiếng nói thực tế: ${error.message}`);
  }
}

// Kiểm tra kết nối đến server
function testServerConnection() {
  log('Kiểm tra server socket thông qua ping...');
  socket.emit('ping', { timestamp: Date.now() });
  
  // Đợi phản hồi từ server trong 2 giây
  setTimeout(() => {
    if (!socket.connected) {
      log('CẢNH BÁO: Không nhận được phản hồi ping từ server!');
    }
  }, 2000);
}

// Xử lý sự kiện kết nối
socket.on('connect', () => {
  log(`Đã kết nối thành công! Socket ID: ${socket.id}`);
  
  // Kiểm tra kết nối
  testServerConnection();
  
  // Test hàm start-recognition
  log('Gửi lệnh start-recognition với ngôn ngữ tiếng Việt...');
  socket.emit('start-recognition', { language: 'vi' });
  
  // Mô phỏng từng từ được nói
  setTimeout(async () => {
    log('Bắt đầu mô phỏng tiếng nói đơn giản...');
    await simulateWord();
    
    // Đợi một khoảng thời gian và mô phỏng tiếng nói thực tế
    setTimeout(async () => {
      log('Bắt đầu mô phỏng tiếng nói thực tế...');
      await simulateRealSpeech();
      
      log('Hoàn thành việc gửi audio. Đợi server xử lý...');
    }, 3000);
    
  }, 2000);
  
  // Dừng nhận diện sau khoảng thời gian cho phép xử lý
  setTimeout(() => {
    log('Gửi lệnh stop-recognition...');
    socket.emit('stop-recognition');
    
    log(`Tóm tắt kiểm tra:
    - Socket port: ${TEST_CONFIG.socketPort}
    - Định dạng audio: ${TEST_CONFIG.audioFormat}
    - Chế độ gửi dữ liệu: ${TEST_CONFIG.sendMode}
    - Không nhận được kết quả? Hãy thử các cấu hình khác
    `);
  }, TEST_CONFIG.processingTimeout);
  
  // Ngắt kết nối sau thêm 5 giây nữa
  setTimeout(() => {
    log('Ngắt kết nối socket...');
    socket.disconnect();
    process.exit(0);
  }, TEST_CONFIG.processingTimeout + 5000);
});

// Thêm lắng nghe sự kiện ping phản hồi từ server
socket.on('pong', (data) => {
  const roundTripTime = Date.now() - data.timestamp;
  log(`Nhận được phản hồi pong từ server. Round-trip: ${roundTripTime}ms`);
});

// Lắng nghe kết quả transcription
socket.on('transcription-result', (data) => {
  log(`✅ NHẬN ĐƯỢC KẾT QUẢ NHẬN DIỆN: ${JSON.stringify(data)}`);
  
  // Yêu cầu dịch
  if (data.text) {
    log(`Gửi yêu cầu dịch văn bản: "${data.text}"`);
    socket.emit('translate-text', {
      text: data.text,
      source: 'vi',
      target: 'en',
      context: null
    });
  }
});

// Lắng nghe kết quả dịch
socket.on('translation-result', (data) => {
  log(`✅ NHẬN ĐƯỢC KẾT QUẢ DỊCH: ${JSON.stringify(data)}`);
});

// Lắng nghe trạng thái nhận diện
socket.on('recognition-status', (data) => {
  log(`ℹ️ Nhận được trạng thái nhận diện: ${JSON.stringify(data)}`);
});

// Xử lý lỗi kết nối
socket.on('connect_error', (error) => {
  log(`❌ Lỗi kết nối: ${error.message}`);
});

// Xử lý ngắt kết nối
socket.on('disconnect', (reason) => {
  log(`⚠️ Mất kết nối: ${reason}`);
});

// Bắt tất cả các sự kiện khác mà server có thể gửi
socket.onAny((eventName, ...args) => {
  if (!['transcription-result', 'translation-result', 'recognition-status', 'pong', 'disconnect'].includes(eventName)) {
    log(`Nhận được sự kiện không xác định: ${eventName}`);
    log(`Dữ liệu: ${JSON.stringify(args)}`);
  }
}); 
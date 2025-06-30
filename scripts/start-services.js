/**
 * Script khởi động các dịch vụ Python
 */
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

// Xác định môi trường
const isWindows = os.platform() === 'win32';
const pythonCmd = isWindows ? 'venv\\Scripts\\python.exe' : 'venv/bin/python';
const activateCmd = isWindows ? 'call venv\\Scripts\\activate' : 'source venv/bin/activate';

// Đường dẫn đến các dịch vụ
const SERVICES = [
  {
    name: 'PhoWhisper ASR',
    script: 'server/services/phowhisper_asr_service/run_phowhisper.py',
    color: '\x1b[36m', // Cyan
    port: 50051
  },
  {
    name: 'Translation',
    script: 'server/services/translation_service/run_translation.py',
    color: '\x1b[32m', // Green
    port: 50052,
    delay: 5000 // Đợi 5 giây sau khi khởi động ASR
  },
  {
    name: 'TTS',
    script: 'server/services/tts_service/run_tts.py',
    color: '\x1b[35m', // Magenta
    port: 5002,
    delay: 10000 // Đợi 10 giây sau khi khởi động Translation
  }
];

// Color reset
const RESET_COLOR = '\x1b[0m';

// Hàm khởi động dịch vụ
function startService(service) {
  return new Promise((resolve) => {
    if (service.delay) {
      console.log(`${service.color}Đợi ${service.delay/1000}s trước khi khởi động ${service.name}...${RESET_COLOR}`);
      setTimeout(() => {
        launchService(service, resolve);
      }, service.delay);
    } else {
      launchService(service, resolve);
    }
  });
}

// Hàm chạy dịch vụ
function launchService(service, resolve) {
  console.log(`${service.color}Khởi động ${service.name} Service...${RESET_COLOR}`);
  
  // Tạo lệnh chạy dịch vụ
  const child = spawn(pythonCmd, [service.script], {
    shell: true,
    cwd: process.cwd()
  });

  // Xử lý output
  child.stdout.on('data', (data) => {
    console.log(`${service.color}[${service.name}] ${data.toString().trim()}${RESET_COLOR}`);
  });

  child.stderr.on('data', (data) => {
    console.error(`${service.color}[${service.name} ERROR] ${data.toString().trim()}${RESET_COLOR}`);
  });

  // Xử lý khi dịch vụ kết thúc
  child.on('close', (code) => {
    if (code !== 0) {
      console.error(`${service.color}[${service.name}] Dịch vụ đã dừng với mã lỗi ${code}${RESET_COLOR}`);
    } else {
      console.log(`${service.color}[${service.name}] Dịch vụ đã dừng thành công${RESET_COLOR}`);
    }
  });

  // Lưu trữ tiến trình con
  service.process = child;
  resolve(child);
}

// Hàm chính để khởi động tất cả các dịch vụ
async function startAllServices() {
  console.log('\x1b[33m%s\x1b[0m', '=== Khởi động các dịch vụ Python ===');
  
  // Khởi động từng dịch vụ theo thứ tự
  for (const service of SERVICES) {
    await startService(service);
  }

  console.log('\x1b[33m%s\x1b[0m', '=== Tất cả các dịch vụ đã được khởi động ===');
  console.log('\x1b[33m%s\x1b[0m', 'Nhấn Ctrl+C để dừng tất cả các dịch vụ');

  // Xử lý khi người dùng nhấn Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n\x1b[33m%s\x1b[0m', 'Đang dừng tất cả các dịch vụ...');
    
    // Dừng tất cả các tiến trình
    SERVICES.forEach(service => {
      if (service.process) {
        service.process.kill();
        console.log(`${service.color}Đã dừng ${service.name} Service${RESET_COLOR}`);
      }
    });
    
    process.exit(0);
  });
}

// Bắt đầu khởi động
startAllServices().catch(err => {
  console.error('\x1b[31m%s\x1b[0m', 'Lỗi khi khởi động dịch vụ:', err);
  process.exit(1);
}); 
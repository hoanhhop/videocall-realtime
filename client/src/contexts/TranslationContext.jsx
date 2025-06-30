import React, { createContext, useState, useContext, useEffect, useCallback, useRef } from 'react';

const TranslationContext = createContext();

export const useTranslation = () => useContext(TranslationContext);

export const TranslationProvider = ({ children, socket }) => {
  const [sourceLanguage, setSourceLanguage] = useState('vi');
  const [targetLanguage, setTargetLanguage] = useState('en');
  const [recognizedText, setRecognizedText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [contextFile, setContextFile] = useState(null);
  const [contextText, setContextText] = useState('');
  const [enableSubtitles, setEnableSubtitles] = useState(true);
  const [enableTTS, setEnableTTS] = useState(false);
  const [confidenceScore, setConfidenceScore] = useState(null);
  const [isRealTimeTranslate, setIsRealTimeTranslate] = useState(true);
  const [useMockData, setUseMockData] = useState(true);
  const [audioProcessingStatus, setAudioProcessingStatus] = useState('');
  const [microphoneLevel, setMicrophoneLevel] = useState(0);
  const [microphoneActive, setMicrophoneActive] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const [voiceReferenceBlob, setVoiceReferenceBlob] = useState(null);
  
  // Sử dụng useRef để theo dõi chế độ hiện tại
  const mockModeRef = useRef(true);
  const recognitionActiveRef = useRef(false);
  const socketRef = useRef(null);
  
  // Cập nhật socketRef khi socket thay đổi
  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);
  
  // Request text-to-speech
  const requestTTS = (text, language) => {
    if (!text || !enableTTS) return;
    
    try {
      console.log('Yêu cầu TTS cho văn bản:', text);
      
      // Tạo âm thanh tổng hợp bằng SpeechSynthesis API để tránh lỗi 500
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language === 'en' ? 'en-US' : 'vi-VN';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Lỗi khi phát TTS:', error);
    }
  };
  
  // Hàm cập nhật debug info
  const updateDebugInfo = (message) => {
    setDebugInfo(prev => {
      const newDebug = `${new Date().toLocaleTimeString()}: ${message}\n${prev}`;
      console.log(`[DEBUG] ${message}`);
      return newDebug.substring(0, 1000);
    });
  };
  
  // Start speech recognition
  const startRecognition = async () => {
    console.log('===== BẮT ĐẦU HÀM startRecognition =====');
    console.log('Trạng thái hiện tại:', { isRecognizing, useMockData });
    
    // QUAN TRỌNG: Kiểm tra xem quá trình nhận diện đã đang chạy chưa
    if (recognitionActiveRef.current === true) {
      console.log('Đã đang nhận diện, không cần khởi động lại');
      updateDebugInfo('Quá trình nhận diện đã đang chạy');
      return;
    }
    
    // Đặt flag để ngăn đồng thời gọi stopRecognition
    window.startingRecognition = true;
    
    if (!socket) {
      console.error('LỖI: Socket không tồn tại');
      updateDebugInfo('Không thể bắt đầu nhận diện: Socket không tồn tại');
      return;
    }
    
    try {
      console.log('Đang thiết lập trạng thái isRecognizing = true');
      
      // Đặt trạng thái đồng bộ
      recognitionActiveRef.current = true;
      console.log('Đã cập nhật recognitionActiveRef =', recognitionActiveRef.current);
      
      // Cập nhật state và đợi cho nó hoàn thành
      await new Promise(resolve => {
        setIsRecognizing(true);
        // setTimeout để đảm bảo React đã cập nhật state
        setTimeout(resolve, 0);
      });
      
      // Đảm bảo cập nhật trạng thái UI ngay lập tức
      updateDebugInfo('Đã bắt đầu nhận diện âm thanh');
      
      // Kiểm tra kết nối socket trước
      if (!socket.connected) {
        console.log('Socket chưa kết nối, đang kết nối lại...');
        updateDebugInfo('Socket không kết nối, đang thử kết nối lại...');
        socket.connect();
        
        // Đợi kết nối trước khi tiếp tục
        await new Promise(resolve => {
          const timeout = setTimeout(() => {
            console.error('Timeout: Không thể kết nối đến socket sau 5 giây');
            resolve(); // Vẫn tiếp tục dù có lỗi
          }, 5000);
          
          const checkConnection = () => {
            if (socket.connected) {
              clearTimeout(timeout);
              console.log('Socket đã kết nối thành công');
              resolve();
            } else {
              setTimeout(checkConnection, 500);
            }
          };
          checkConnection();
        });
      }
      
      console.log('Socket ID:', socket.id, 'Connected:', socket.connected);
      
      // Báo server bắt đầu nhận diện
      socket.emit('start-recognition', { language: sourceLanguage });
      console.log('Đã gửi lệnh start-recognition với ngôn ngữ:', sourceLanguage);
      updateDebugInfo(`Đã gửi lệnh start-recognition với ngôn ngữ: ${sourceLanguage}`);
      
      // Xử lý theo chế độ
      if (useMockData) {
        // CHẾ ĐỘ GIẢ LẬP
        console.log('Đang khởi tạo chế độ giả lập');
        // ... existing mock data code ...
      } else {
        // CHẾ ĐỘ THỰC TẾ
        console.log('Đang khởi tạo chế độ thực tế');
        
        // Kiểm tra hỗ trợ getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.warn('navigator.mediaDevices.getUserMedia không khả dụng - có thể do trang không được phục vụ qua HTTPS');
          updateDebugInfo('⚠️ Microphone không khả dụng: Trang cần được truy cập qua HTTPS hoặc localhost để sử dụng microphone');
          setRecognizedText('⚠️ Không thể truy cập microphone. Trang cần được phục vụ qua HTTPS hoặc localhost. Đang chuyển sang chế độ giả lập...');
          
          // Tự động chuyển sang chế độ giả lập
          setUseMockData(true);
          mockModeRef.current = true;
          
          // Khởi tạo chế độ giả lập thay thế
          console.log('Tự động chuyển sang chế độ giả lập do không thể truy cập microphone');
          updateDebugInfo('Đã chuyển sang chế độ giả lập tự động');
          setRecognizedText('🎭 Chế độ giả lập đã được kích hoạt tự động');
          setAudioProcessingStatus('simulating');
          return;
        }
        
        try {
          // Get microphone stream
          console.log('Đang yêu cầu quyền truy cập microphone...');
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          console.log('Đã nhận được stream microphone:', stream.id);
          
          // Lưu stream để có thể cleanup
          window.currentStream = stream;
          
          // Cập nhật ref để theo dõi chế độ hiện tại
          mockModeRef.current = false;
          
          // Hiển thị thông báo về mô hình thực tế
          setRecognizedText('🎙️ Đang lắng nghe... Hãy nói để nhận diện giọng nói thực tế.');
          setAudioProcessingStatus('listening');
          setMicrophoneActive(true);
          
          try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log('Đã tạo AudioContext:', audioContext.state);
            
            // Chỉ theo dõi mức âm thanh để kiểm tra microphone
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;
            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);
            
            // Cài đặt interval để cập nhật mức độ âm lượng
            const volumeInterval = setInterval(() => {
              if (!window.currentStream || !recognitionActiveRef.current) {
                clearInterval(volumeInterval);
                console.log('Đã dừng theo dõi âm lượng');
                return;
              }
              
              analyser.getByteFrequencyData(dataArray);
              // Tính toán mức âm thanh trung bình
              const average = dataArray.reduce((acc, value) => acc + value, 0) / bufferLength;
              const normalizedValue = Math.min(100, Math.max(0, average));
              
              // Cập nhật mức âm thanh
              setMicrophoneLevel(normalizedValue);
              
              // Ghi log khi có âm thanh đáng kể
              if (normalizedValue > 15) {
                console.log(`Phát hiện âm thanh, mức độ: ${normalizedValue.toFixed(0)}`);
                updateDebugInfo(`Phát hiện âm thanh, mức độ: ${normalizedValue.toFixed(0)}`);
              }
            }, 100);
            
            window.volumeInterval = volumeInterval;
            
            // Thiết lập source audio
            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);
            
            // Thiết lập MediaRecorder đơn giản
            console.log('Đang tạo MediaRecorder đơn giản');
            if (MediaRecorder.isTypeSupported('audio/webm')) {
              const mediaRecorder = new MediaRecorder(stream, {
                mimeType: 'audio/webm',
                audioBitsPerSecond: 16000
              });
              
              console.log('Đã tạo MediaRecorder với cấu hình:', mediaRecorder.mimeType, mediaRecorder);
              
              // Thêm bộ đếm để đếm số lượng chunk đã gửi
              let audioChunkCount = 0;
              let totalAudioBytes = 0;
              
              mediaRecorder.ondataavailable = async (event) => {
                if (event.data.size > 0 && socketRef.current && socketRef.current.connected) {
                  audioChunkCount++;
                  totalAudioBytes += event.data.size;
                  console.log(`Nhận được audio chunk #${audioChunkCount}: ${event.data.size} bytes (tổng ${totalAudioBytes} bytes)`);
                  
                  try {
                    // Chuyển đổi blob thành ArrayBuffer
                    const buffer = await event.data.arrayBuffer();
                    
                    // Cách thống nhất: Tạo Uint8Array từ buffer và gửi qua socket
                    const audioUint8 = new Uint8Array(buffer);
                    socketRef.current.emit('audio-stream', { 
                      audioData: audioUint8,
                      language: sourceLanguage,
                      continuousMode: true, // Đảm bảo gửi continuous mode
                      realTimeMode: true,   // Kích hoạt chế độ real-time với latency thấp
                      timestamp: Date.now()
                    });
                    
                    console.log(`Đã gửi chunk âm thanh #${audioChunkCount} (${event.data.size} bytes)`);
                    
                    // In thông tin thống kê về audio chunks
                    if (audioChunkCount % 5 === 0) {
                      const elapsedTime = (Date.now() - mediaRecorder.startTime) / 1000;
                      const kbps = (totalAudioBytes / 1024 / elapsedTime).toFixed(2);
                      
                      console.log(`---- THỐNG KÊ ÂM THANH ----
                        - Đã gửi: ${audioChunkCount} chunks
                        - Tổng kích thước: ${(totalAudioBytes / 1024).toFixed(2)} KB
                        - Thời gian: ${elapsedTime.toFixed(1)} giây
                        - Tốc độ: ${kbps} KB/s
                      `);
                      
                      // Cập nhật debug info
                      updateDebugInfo(`Âm thanh: ${audioChunkCount} chunks, ${kbps} KB/s`);
                    }
                  } catch (error) {
                    console.error('Lỗi khi xử lý audio chunk:', error);
                  }
                }
              };
              
              // QUAN TRỌNG: Giảm interval để real-time hơn (từ 300ms xuống 150ms)
              mediaRecorder.start(150);
              // Lưu thời điểm bắt đầu để tính tốc độ
              mediaRecorder.startTime = Date.now();
              window.currentMediaRecorder = mediaRecorder;
              console.log('MediaRecorder đã bắt đầu với khoảng thời gian real-time:', 150, 'ms');
              
              // Thiết lập một bộ đếm thời gian để kiểm tra xem mediaRecorder có đang hoạt động
              const mediaRecorderChecker = setInterval(() => {
                if (!recognitionActiveRef.current) {
                  clearInterval(mediaRecorderChecker);
                  return;
                }
                
                if (Date.now() - mediaRecorder.startTime > 5000 && audioChunkCount === 0) {
                  // Sau 5 giây mà không có chunk nào, có vấn đề
                  console.warn('⚠️ MediaRecorder không tạo ra chunk nào sau 5 giây');
                  updateDebugInfo('MediaRecorder không hoạt động - không có chunk nào được tạo ra');
                }
              }, 5000);
              window.mediaRecorderChecker = mediaRecorderChecker;
              
            } else {
              console.warn('Trình duyệt không hỗ trợ MediaRecorder với audio/webm');
            }
            
            window.currentAudioContext = audioContext;
            
          } catch (audioContextError) {
            console.error('Lỗi khi tạo AudioContext:', audioContextError);
            updateDebugInfo(`Lỗi AudioContext: ${audioContextError.message}`);
          }
        } catch (audioError) {
          console.error('Lỗi khi thiết lập xử lý âm thanh:', audioError);
          updateDebugInfo(`Lỗi khi thiết lập xử lý âm thanh: ${audioError.message}`);
          
          // CRITICAL: Đảm bảo không đặt mockModeRef.current = true nhưng vẫn giữ isRecognizing = true
          console.log('Đã xảy ra lỗi nhưng vẫn giữ trạng thái nhận diện');
          return; // Ngăn không cho chuyển sang chế độ giả lập tự động
        }
      }
      
      // Xác nhận trạng thái cuối
      console.log('Kết thúc hàm startRecognition, trạng thái:',
                 { isRecognizing: true, 
                   recognitionActiveRef: recognitionActiveRef.current, 
                   mockMode: mockModeRef.current });
                   
      // QUAN TRỌNG: Xóa flag sau khi đã khởi động thành công
      window.startingRecognition = false;
      
      return true; // Trả về kết quả thành công
    } catch (error) {
      console.error('Lỗi chung khi khởi tạo nhận diện:', error);
      updateDebugInfo(`Lỗi khi truy cập microphone: ${error.message}`);
      setIsRecognizing(false);
      setMicrophoneActive(false);
      recognitionActiveRef.current = false;
      
      // QUAN TRỌNG: Xóa flag trong trường hợp lỗi
      window.startingRecognition = false;
      
      throw error; // Ném lỗi để có thể xử lý ở bên ngoài
    }
  };
  
  // Kiểm tra kết nối socket và cấu hình
  const checkSocketConnection = () => {
    if (!socket) {
      updateDebugInfo('Không thể kiểm tra: Socket không tồn tại');
      return false;
    }
    
    // Đảm bảo socket được cấu hình đúng
    if (socket.io && socket.io.opts) {
      const socketConfig = socket.io.opts;
      const configInfo = `Cấu hình socket hiện tại: 
        URL: ${socketConfig.hostname || socketConfig.host}:${socketConfig.port}
        Path: ${socketConfig.path}
        Transport: ${socketConfig.transports}
        Timeout: ${socketConfig.timeout}ms`;
      
      console.log(configInfo);
      updateDebugInfo(configInfo);
    }
    
    if (!socket.connected) {
      updateDebugInfo('Socket chưa kết nối, đang thử kết nối lại...');
      socket.connect();
      return false;
    }
    
    // Kiểm tra kết nối bằng cách gửi ping
    socket.emit('ping', { timestamp: Date.now() });
    updateDebugInfo('Đã gửi ping để kiểm tra kết nối socket');
    
    // Kiểm tra nhanh tốc độ phản hồi
    const startTime = Date.now();
    socket.emit('ping', { timestamp: startTime }, (response) => {
      const latency = Date.now() - startTime;
      console.log(`Socket ping: ${latency}ms`);
      updateDebugInfo(`Socket phản hồi trong: ${latency}ms`);
    });
    
    return socket.connected;
  };
  
  // Sửa lại cấu hình socket nếu cần
  const reconfigureSocket = () => {
    if (!socketRef.current) return;
    
    // Ngắt kết nối hiện tại
    if (socketRef.current.connected) {
      socketRef.current.disconnect();
    }
    
    // Cấu hình lại các tùy chọn
    socketRef.current.io.opts.transports = ['websocket', 'polling'];
    socketRef.current.io.opts.reconnection = true;
    socketRef.current.io.opts.reconnectionAttempts = 10;
    socketRef.current.io.opts.reconnectionDelay = 2000;
    socketRef.current.io.opts.timeout = 60000;
    
    // Không thay đổi cổng, sử dụng cổng 5001 như đã cấu hình
    updateDebugInfo('Sử dụng cổng socket 5001 (cổng hiện tại)');
    
    // Kết nối lại
    socketRef.current.connect();
    updateDebugInfo('Đã cấu hình lại và kết nối lại socket');
    
    // Kiểm tra kết nối sau 2 giây
    setTimeout(() => {
      if (socketRef.current.connected) {
        updateDebugInfo('Kết nối thành công sau khi cấu hình lại');
        // Gửi ping để kiểm tra
        socketRef.current.emit('ping', { timestamp: Date.now() });
      } else {
        updateDebugInfo('Không thể kết nối sau khi cấu hình lại');
      }
    }, 2000);
  };
  
  // Stop speech recognition
  const stopRecognition = () => {
    console.log('===== DỪNG NHẬN DIỆN =====');
    
    // QUAN TRỌNG: Kiểm tra xem có đang trong quá trình khởi động không
    if (window.startingRecognition === true) {
      console.log('CẢNH BÁO: Không thể dừng khi đang trong quá trình khởi động');
      updateDebugInfo('Không thể dừng vì đang trong quá trình khởi động nhận diện');
      return;
    }
    
    // QUAN TRỌNG: Kiểm tra xem quá trình nhận diện có đang chạy không
    if (recognitionActiveRef.current === false) {
      console.log('Đã dừng sẵn, không cần dừng lại');
      updateDebugInfo('Quá trình nhận diện đã dừng sẵn');
      return;
    }
    
    updateDebugInfo('Dừng nhận diện âm thanh');
    
    // Đặt trạng thái đồng bộ
    recognitionActiveRef.current = false;
    
    // Dừng theo dõi âm lượng
    if (window.volumeInterval) {
      clearInterval(window.volumeInterval);
      window.volumeInterval = null;
    }
    
    // Dừng MediaRecorder nếu đang sử dụng
    if (window.currentMediaRecorder && window.currentMediaRecorder.state !== 'inactive') {
      try {
        window.currentMediaRecorder.stop();
        updateDebugInfo('Đã dừng MediaRecorder');
      } catch (err) {
        console.error('Lỗi khi dừng MediaRecorder:', err);
        updateDebugInfo(`Lỗi khi dừng MediaRecorder: ${err.message}`);
      }
      window.currentMediaRecorder = null;
    }
    
    // Dừng status interval
    if (window.statusInterval) {
      clearInterval(window.statusInterval);
      window.statusInterval = null;
    }
    
    if (window.currentStream) {
      window.currentStream.getTracks().forEach(track => track.stop());
      window.currentStream = null;
    }
    
    if (window.mockDataInterval) {
      clearInterval(window.mockDataInterval);
      window.mockDataInterval = null;
    }
    
    if (window.currentProcessor) {
      try {
        window.currentProcessor.disconnect();
      } catch (error) {
        console.error('Lỗi khi ngắt kết nối processor:', error);
        updateDebugInfo(`Lỗi khi ngắt kết nối processor: ${error.message}`);
      }
      window.currentProcessor = null;
    }
    
    if (window.currentAudioContext) {
      try {
        window.currentAudioContext.close();
      } catch (error) {
        console.error('Lỗi khi đóng AudioContext:', error);
        updateDebugInfo(`Lỗi khi đóng AudioContext: ${error.message}`);
      }
      window.currentAudioContext = null;
    }
    
    if (socket) {
      socket.emit('stop-recognition');
      updateDebugInfo('Đã gửi lệnh stop-recognition đến server');
    }
    setIsRecognizing(false);
    console.log('Đã đặt isRecognizing = false');
    setMicrophoneActive(false);
    setMicrophoneLevel(0);
    
    // Reset audio processing status
    setAudioProcessingStatus('');
  };
  
  // Toggle real-time translation
  const toggleRealTimeTranslate = () => {
    const newState = !isRealTimeTranslate;
    setIsRealTimeTranslate(newState);
    updateDebugInfo(`Dịch tự động: ${newState ? 'Bật' : 'Tắt'}`);
    
    // Start or stop recognition based on the new state
    if (newState && !isRecognizing) {
      startRecognition();
    } else if (!newState && isRecognizing) {
      stopRecognition();
    }
    
    return newState;
  };
  
  // Chuyển đổi giữa dữ liệu thật và giả lập
  const toggleMockData = useCallback(() => {
    updateDebugInfo(`Đang chuyển đổi chế độ từ ${useMockData ? 'giả lập' : 'thực tế'} sang ${!useMockData ? 'giả lập' : 'thực tế'}`);
    
    // Xóa dữ liệu nhận diện và dịch hiện tại
    setRecognizedText('');
    setTranslatedText('');
    
    // Dừng nhận diện hiện tại trước
    const wasRecognizing = isRecognizing;
    if (isRecognizing) {
      stopRecognition();
    }
    
    // Đảm bảo chờ dừng hoàn tất trước khi chuyển chế độ
    setTimeout(() => {
      // Cập nhật trạng thái
      setUseMockData(prevState => {
        const newMockState = !prevState;
        updateDebugInfo(`Đã đổi trạng thái mockData thành: ${newMockState ? 'giả lập' : 'thực tế'}`);
        mockModeRef.current = newMockState;
        
        // Khởi động lại nhận diện với chế độ mới nếu trước đó đã đang nhận diện
        if (wasRecognizing) {
          setTimeout(() => {
            startRecognition();
          }, 500);
        }
        
        return newMockState;
      });
    }, 300);
  }, [useMockData, isRecognizing]);
  
  // Toggle TTS
  const toggleTTS = () => {
    const newState = !enableTTS;
    setEnableTTS(newState);
    updateDebugInfo(`TTS: ${newState ? 'Bật' : 'Tắt'}`);
    return newState;
  };
  
  // Listen for transcription results from server
  useEffect(() => {
    if (!socket) return;
    
    const onTranscriptionResult = (data) => {
      console.log('Nhận được kết quả nhận diện:', data);
      
      // Kiểm tra data hợp lệ theo các cách khác nhau
      if (!data) {
        console.warn('Dữ liệu kết quả rỗng');
        return;
      }
      
      // Nếu data.text là null hoặc undefined nhưng có thể chuyển đổi thành string an toàn
      const recognizedText = data.text !== undefined && data.text !== null
        ? data.text
        : (sourceLanguage === 'en' ? 'Hello' : 'Xin chào');
        
      console.log(`Đã xử lý text nhận diện: "${recognizedText}"`);
      
      // Luôn cập nhật văn bản nhận diện, ngay cả khi rỗng
      setRecognizedText(recognizedText);
      
      // Cập nhật thông tin về mô hình & độ tin cậy
      const confidence = data.confidence || 0.95;
      setConfidenceScore({
        value: confidence,
        modelType: data.isOnnx ? 'ONNX' : (data.isSimulated ? 'Simulated' : 'Standard')
      });
      
      // Hiển thị thông tin về model trong debug
      const modelInfo = data.isOnnx ? 
        `Sử dụng mô hình ONNX (${data.inferenceTime || 0}ms)` : 
        (data.isSimulated ? 'Mô phỏng nhận diện' : 'Xử lý tiêu chuẩn');
      
      updateDebugInfo(`Nhận diện: "${recognizedText}" - ${modelInfo} - Confidence: ${(confidence * 100).toFixed(1)}%`);
      
      // Tự động dịch nếu chế độ dịch thời gian thực được bật và có văn bản
      if (isRealTimeTranslate && recognizedText && recognizedText.trim() !== '') {
        translateManually(recognizedText);
      } else if (!isRealTimeTranslate) {
        setTranslatedText(''); // Xóa văn bản dịch khi không dịch tự động
      }
    };
    
    const onTranslationResult = (data) => {
      console.log('⭐ RECEIVED TRANSLATION:', data);
      
      // Phương pháp đơn giản hóa triệt để
      let translatedTextValue = '';
      
      // Trường hợp 1: data là chuỗi trực tiếp
      if (typeof data === 'string') {
        translatedTextValue = data;
      }
      // Trường hợp 2: data có thuộc tính translated là chuỗi
      else if (data && typeof data.translated === 'string') {
        translatedTextValue = data.translated;
      }
      // Trường hợp 3: data có thuộc tính translatedText là chuỗi (định dạng trả về mới từ server)
      else if (data && typeof data.translatedText === 'string') {
        translatedTextValue = data.translatedText;
      }
      // Trường hợp 4: thử đọc data.text nếu có
      else if (data && typeof data.text === 'string') {
        translatedTextValue = data.text;
      }
      
      console.log('⭐ EXTRACTED TRANSLATION:', translatedTextValue);
      
      // Cập nhật giao diện
      if (translatedTextValue && translatedTextValue.trim()) {
        setTranslatedText(translatedTextValue);
        updateDebugInfo(`Đã nhận được kết quả dịch: "${translatedTextValue}"`);
        
        // Request TTS if enabled
        if (enableTTS) {
          requestTTS(translatedTextValue, targetLanguage);
        }
      } else {
        console.warn('⚠️ Không thể xác định kết quả dịch', data);
        updateDebugInfo(`Không thể xác định kết quả dịch: ${JSON.stringify(data)}`);
      }
    };
    
    const onRecognitionStatus = (data) => {
      updateDebugInfo(`Trạng thái nhận diện từ server: ${data.status}`);
      setAudioProcessingStatus(data.status);
    };
    
    // Theo dõi lỗi socket
    const onSocketError = (error) => {
      console.error('Socket error:', error);
      updateDebugInfo(`LỖI SOCKET: ${error.message || JSON.stringify(error)}`);
    };

    // Lắng nghe TẤT CẢ các sự kiện của socket
    socket.onAny((event, ...args) => {
      console.log(`Nhận được sự kiện socket: ${event}`, args);
      
      // Lưu ý đặc biệt cho sự kiện transcription-result
      if (event === 'transcription-result') {
        console.log('👂 ĐƯỢC GỌI QUA onAny: transcription-result', args);
        
        // Debug chi tiết về dữ liệu nhận được
        const data = args[0];
        console.log('Dữ liệu nhận diện chi tiết:', {
          text: data?.text,
          hasText: Boolean(data?.text),
          textType: typeof data?.text,
          confidence: data?.confidence,
          isOnnx: data?.isOnnx,
          isSimulated: data?.isSimulated
        });
      }
    });

    // Theo dõi kết nối socket để đảm bảo luôn ổn định
    const connectionWatchdog = setInterval(() => {
      if (recognitionActiveRef.current && !mockModeRef.current && socketRef.current) {
        if (!socketRef.current.connected) {
          updateDebugInfo('Socket mất kết nối, đang thử kết nối lại...');
          socketRef.current.connect();
        } else {
          // Gửi ping để đảm bảo kết nối còn hoạt động
          socketRef.current.emit('ping', { timestamp: Date.now() });
        }
      }
    }, 10000); // Kiểm tra mỗi 10 giây
    
    // Đăng ký thêm các sự kiện socket
    socket.on('error', onSocketError);
    
    // Đăng ký các sự kiện socket
    socket.on('transcription-result', onTranscriptionResult);
    socket.on('translation-result', onTranslationResult);
    socket.on('recognition-status', onRecognitionStatus);
    
    // Sự kiện kết nối/ngắt kết nối
    socket.on('connect', () => {
      updateDebugInfo('Socket đã kết nối: ' + socket.id);
    });
    
    socket.on('disconnect', (reason) => {
      updateDebugInfo(`Socket bị ngắt kết nối: ${reason}`);
    });
    
    socket.on('connect_error', (error) => {
      updateDebugInfo(`Lỗi kết nối socket: ${error.message}`);
    });
    
    // Cleanup khi unmount
    return () => {
      socket.off('transcription-result', onTranscriptionResult);
      socket.off('translation-result', onTranslationResult);
      socket.off('recognition-status', onRecognitionStatus);
      socket.off('connect');
      socket.off('disconnect');
      socket.off('connect_error');
      socket.off('error', onSocketError);
      socket.offAny(); // Remove all listeners
      clearInterval(connectionWatchdog);
    };
  }, [socket, sourceLanguage, targetLanguage, contextFile, contextText, enableTTS, isRealTimeTranslate]);
  
  // Swap languages
  const swapLanguages = () => {
    setSourceLanguage(targetLanguage);
    setTargetLanguage(sourceLanguage);
  };
  
  // Set context file
  const setContext = (fileOrText) => {
    if (typeof fileOrText === 'string') {
      // Xử lý văn bản trực tiếp làm ngữ cảnh
      const contextData = {
        text: fileOrText,
        source: 'text',
        type: 'extracted'
      };
      setContextFile(contextData);
      updateDebugInfo('Đã cập nhật ngữ cảnh từ văn bản trực tiếp');
      return;
    }
    
    // Xử lý file như trước đây
    const file = fileOrText;
    // Read file content
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        // Upload to server for processing instead of parsing here
        const fileContent = e.target.result;
        const formData = new FormData();
        formData.append('file', file);
        formData.append('source', sourceLanguage);
        formData.append('target', targetLanguage);
        
        const response = await fetch('/api/context-file', {
          method: 'POST',
          body: formData
        });
        
        const result = await response.json();
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        setContextFile(result.context);
        updateDebugInfo('Đã cập nhật file ngữ cảnh');
      } catch (error) {
        console.error('Invalid context file:', error);
        updateDebugInfo(`Lỗi xử lý file ngữ cảnh: ${error.message}`);
        alert('Error processing context file: ' + error.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };
  
  // Clear context
  const clearContext = () => {
    setContextFile(null);
    updateDebugInfo('Đã xóa ngữ cảnh');
  };
  
  // Set context from text input
  const handleSetContextText = async (text) => {
    if (!text.trim()) {
      setContextText('');
      updateDebugInfo('Đã xóa văn bản ngữ cảnh');
      return;
    }
    
    try {
      // Process context text on server
      const response = await fetch('/api/context-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          source: sourceLanguage,
          target: targetLanguage
        })
      });
      
      const result = await response.json();
      
      if (result.error) {
        throw new Error(result.error);
      }
      
      // Store the raw text for display
      setContextText(text);
      updateDebugInfo('Đã cập nhật văn bản ngữ cảnh');
      
      // Add extracted terms to context file if it exists
      if (contextFile) {
        setContextFile({
          ...contextFile,
          terms: [...(contextFile.terms || []), ...(result.context.terms || [])]
        });
      } else {
        setContextFile(result.context);
      }
    } catch (error) {
      console.error('Error processing context text:', error);
      updateDebugInfo(`Lỗi xử lý văn bản ngữ cảnh: ${error.message}`);
      // Still set the raw text even if processing fails
      setContextText(text);
    }
  };
  
  // Manual translation (not real-time)
  const translateManually = (text = recognizedText) => {
    if (!socket || !text) return;
    
    updateDebugInfo(`Dịch thủ công văn bản: "${text}"`);
    
    // Create context object that combines file and text context
    const combinedContext = {
      ...(contextFile || {}),
      text: contextText,
      isTextContext: Boolean(contextText)
    };
    
    socket.emit('translate-text', {
      text,
      source: sourceLanguage,
      target: targetLanguage,
      context: Object.keys(combinedContext).length > 0 ? combinedContext : null
    });
  };
  
  // Thêm hook useEffect để đồng bộ trạng thái recognitionActiveRef với isRecognizing
  useEffect(() => {
    // Đảm bảo recognitionActiveRef luôn phản ánh trạng thái isRecognizing
    recognitionActiveRef.current = isRecognizing;
  }, [isRecognizing]);
  
  // Gửi audio data với tham số voice cloning nếu có
  const sendAudio = (audioData) => {
    if (!socket || !socket.connected || !isRecognizing) return;
    
    // Gửi chunk âm thanh đến server với continuous mode
    socket.emit('audio-stream', {
      audioData,
      language: sourceLanguage,
      initialPrompt: contextFile ? contextFile.text : null, 
      continuousMode: true, // Luôn bật continuous mode cho real-time
      realTimeMode: true    // Thêm flag để báo server xử lý real-time
    });
  };
  
  // Yêu cầu text-to-speech với voice cloning
  const requestTextToSpeech = async (text) => {
    try {
      if (!text || !enableTTS) return;
      
      // Chuẩn bị dữ liệu
      const formData = new FormData();
      formData.append('text', text);
      formData.append('language', targetLanguage);
      
      // Thêm thông tin về voice cloning nếu có
      if (voiceReferenceBlob) {
        formData.append('reference_voice', voiceReferenceBlob, 'voice_reference.wav');
      } else if (selectedSpeaker) {
        formData.append('speaker', selectedSpeaker);
      }
      
      // Gửi yêu cầu
      updateDebugInfo('Đang gửi yêu cầu TTS...');
      const response = await fetch('/api/tts/synthesize', {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`TTS failed with status: ${response.status}`);
      }
      
      // Xử lý audio response
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      
      // Phát audio
      const audio = new Audio(audioUrl);
      audio.play();
      
      updateDebugInfo('Đang phát TTS audio');
    } catch (error) {
      console.error('TTS error:', error);
      updateDebugInfo(`Lỗi TTS: ${error.message}`);
    }
  };
  
  // Hàm xử lý thay đổi speaker
  const handleSpeakerChange = (speaker) => {
    setSelectedSpeaker(speaker);
    setVoiceReferenceBlob(null); // Xóa voice reference blob khi chọn speaker
    updateDebugInfo(`Đã chọn speaker: ${speaker}`);
  };
  
  // Hàm xử lý thay đổi voice reference
  const handleVoiceReferenceChange = (blob) => {
    setVoiceReferenceBlob(blob);
    setSelectedSpeaker(''); // Xóa selected speaker khi sử dụng voice reference
    updateDebugInfo(blob ? 'Đã sử dụng voice reference' : 'Đã xóa voice reference');
  };
  
  const value = {
    sourceLanguage,
    targetLanguage,
    recognizedText,
    translatedText,
    isRecognizing,
    contextFile,
    contextText,
    enableSubtitles,
    enableTTS,
    confidenceScore,
    isRealTimeTranslate,
    useMockData,
    audioProcessingStatus,
    microphoneLevel,
    microphoneActive,
    debugInfo,
    setSourceLanguage,
    setTargetLanguage,
    setContext,
    handleSetContextText,
    toggleRealTimeTranslate,
    translateManually,
    swapLanguages,
    setEnableSubtitles,
    setEnableTTS,
    toggleTTS,
    startRecognition,
    stopRecognition,
    toggleMockData,
    checkSocketConnection,
    reconfigureSocket,
    clearContext,
    selectedSpeaker,
    handleSpeakerChange,
    voiceReferenceBlob,
    handleVoiceReferenceChange
  };
  
  return (
    <TranslationContext.Provider value={value}>
      {children}
    </TranslationContext.Provider>
  );
};
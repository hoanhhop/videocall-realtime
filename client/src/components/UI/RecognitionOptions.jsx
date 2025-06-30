import React from 'react';
import { useTranslation } from '../../contexts/TranslationContext';
import './RecognitionOptions.css';

const RecognitionOptions = () => {
  const {
    isRecognizing,
    useMockData,
    toggleMockData,
    startRecognition,
    stopRecognition,
    isRealTimeTranslate,
    toggleRealTimeTranslate,
    enableTTS,
    toggleTTS,
    audioProcessingStatus
  } = useTranslation();

  // Xử lý sự kiện chuyển chế độ
  const handleToggleMockData = () => {
    console.log('Bấm nút chuyển chế độ');
    toggleMockData();
  };
  
  // Hiển thị trạng thái xử lý âm thanh
  const getAudioStatusText = () => {
    if (!isRecognizing) return '';
    
    if (!useMockData) {
      switch (audioProcessingStatus) {
        case 'listening':
          return '(Đang lắng nghe)';
        case 'processing':
          return '(Đang xử lý âm thanh)';
        default:
          return '(Đang kết nối)';
      }
    } else {
      return '(Đang chạy)';
    }
  };

  return (
    <div className="recognition-options">
      <h3>Tùy chọn nhận diện</h3>
      
      <div className="option-row">
        <button 
          className={`toggle-button ${isRecognizing ? 'active' : ''}`}
          onClick={isRecognizing ? stopRecognition : startRecognition}
        >
          {isRecognizing ? 'Dừng nhận diện' : 'Bắt đầu nhận diện'}
        </button>
        
        <button 
          className={`toggle-button ${isRealTimeTranslate ? 'active' : ''}`}
          onClick={toggleRealTimeTranslate}
        >
          {isRealTimeTranslate ? 'Dịch tự động: Bật' : 'Dịch tự động: Tắt'}
        </button>
      </div>
      
      <div className="option-row">
        <button 
          className={`toggle-button ${enableTTS ? 'active' : ''}`}
          onClick={toggleTTS}
        >
          {enableTTS ? 'Phát âm: Bật' : 'Phát âm: Tắt'}
        </button>
      </div>
      
      <div className="option-row mock-toggle">
        <span>Chế độ:</span>
        <div className="mode-selector">
          <button 
            className={`toggle-button ${useMockData ? 'mock' : 'real'}`}
            onClick={handleToggleMockData}
            id="toggle-mock-button"
          >
            {useMockData ? 'Đang dùng dữ liệu giả lập' : 'Đang dùng micro thực tế'}
          </button>
          <span className="status-indicator">{getAudioStatusText()}</span>
        </div>
      </div>
      
      {useMockData && (
        <div className="mock-info">
          <p>
            Chế độ giả lập sẽ hiển thị các đoạn văn bản mẫu thay vì nhận diện âm thanh thực tế.
            Điều này giúp kiểm tra giao diện khi server xử lý âm thanh chưa sẵn sàng.
          </p>
        </div>
      )}
      
      {!useMockData && isRecognizing && (
        <div className="real-mode-info">
          <p>
            Đang sử dụng microphone để nhận diện. Nếu không thấy kết quả sau khi nói, hãy kiểm tra:
          </p>
          <ul>
            <li>Microphone đã được bật và cho phép</li>
            <li>Nói đủ to để hệ thống nghe được</li>
            <li>Server đang hoạt động và kết nối</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default RecognitionOptions; 
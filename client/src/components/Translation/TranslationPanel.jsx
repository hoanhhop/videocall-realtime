import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from '../../contexts/TranslationContext';
import ContextUploader from './ContextUploader';
import SpeakerSelector from './SpeakerSelector';
import './TranslationPanel.css';

const TranslationPanel = () => {
  const {
    recognizedText,
    translatedText,
    sourceLanguage,
    targetLanguage,
    isRecognizing,
    startRecognition,
    stopRecognition,
    translateManually,
    isRealTimeTranslate,
    useMockData,
    toggleMockData,
    microphoneLevel,
    microphoneActive,
    debugInfo,
    checkSocketConnection,
    reconfigureSocket,
    confidenceScore,
    handleSpeakerChange,
    handleVoiceReferenceChange
  } = useTranslation();

  const [showDebug, setShowDebug] = useState(false);
  const [showAdvancedFeatures, setShowAdvancedFeatures] = useState(false);
  // Lưu trữ giá trị microphoneLevel cao nhất trong khoảng thời gian gần đây
  const [peakLevel, setPeakLevel] = useState(0);
  // Thêm state để hiển thị trạng thái âm thanh đang hoạt động
  const [isSpeaking, setIsSpeaking] = useState(false);
  // Sử dụng ref để đếm thời gian im lặng
  const silenceTimer = useRef(null);
  
  // Force update status
  const [panelState, setPanelState] = useState({
    lastUpdateTime: Date.now(),
    forceUpdateCounter: 0
  });
  
  // Cập nhật lại panel state mỗi giây
  useEffect(() => {
    const updateInterval = setInterval(() => {
      setPanelState(prev => ({
        lastUpdateTime: Date.now(),
        forceUpdateCounter: prev.forceUpdateCounter + 1
      }));
    }, 1000);
    
    return () => clearInterval(updateInterval);
  }, []);
  
  // Hàm yêu cầu cập nhật UI ngay lập tức
  const forceUIUpdate = useCallback(() => {
    setPanelState(prev => ({
      lastUpdateTime: Date.now(),
      forceUpdateCounter: prev.forceUpdateCounter + 1
    }));
  }, []);
  
  // Theo dõi mức âm thanh và cập nhật trạng thái speaking
  useEffect(() => {
    // Nếu mức âm thanh vượt ngưỡng, coi như đang nói
    if (microphoneLevel > 15) {
      setIsSpeaking(true);
      setPeakLevel(prev => Math.max(prev, microphoneLevel));
      
      // Xóa bộ đếm im lặng hiện tại nếu có
      if (silenceTimer.current) {
        clearTimeout(silenceTimer.current);
      }
      
      // Đặt bộ đếm mới
      silenceTimer.current = setTimeout(() => {
        setIsSpeaking(false);
        // Giảm dần giá trị peak sau khi im lặng
        setPeakLevel(prev => Math.max(0, prev - 10));
      }, 1000); // 1 giây không có âm thanh = im lặng
    }
    
    // Dọn dẹp khi component unmount
    return () => {
      if (silenceTimer.current) {
        clearTimeout(silenceTimer.current);
      }
    };
  }, [microphoneLevel]);

  const handleStartStop = () => {
    console.log("Đã nhấn nút bắt đầu/dừng");
    console.log("Trạng thái trước khi gọi:", isRecognizing);
    
    if (isRecognizing) {
      stopRecognition();
      
      // Cập nhật UI
      forceUIUpdate();
      
      // Kiểm tra sau 500ms để xem trạng thái có thay đổi chưa
      setTimeout(() => {
        console.log("Trạng thái sau khi dừng (500ms):", isRecognizing);
        forceUIUpdate();
      }, 500);
    } else {
      // Thử thêm thông báo để debug
      console.log("Đang gọi startRecognition()");
      startRecognition();
      
      // Cập nhật UI
      forceUIUpdate();
      
      // Kiểm tra sau 500ms để xem trạng thái có thay đổi chưa
      setTimeout(() => {
        console.log("Trạng thái sau khi bắt đầu (500ms):", isRecognizing);
        forceUIUpdate();
        
        // Hiển thị thông báo trạng thái
        if (!isRecognizing) {
          alert("Không thể bắt đầu nhận diện. Hãy kiểm tra console để xem log lỗi.");
        }
      }, 500);
    }
  };

  const handleTranslate = () => {
    translateManually();
  };

  const handleToggleDebug = () => {
    setShowDebug(!showDebug);
  };

  // Thêm handler cho toggle advanced features
  const toggleAdvancedFeatures = () => {
    setShowAdvancedFeatures(!showAdvancedFeatures);
  };

  // Hiển thị thông tin về độ tin cậy và model
  const renderConfidenceInfo = () => {
    if (!confidenceScore) return null;
    
    // Kiểm tra xem confidenceScore có phải là object không
    if (typeof confidenceScore === 'object') {
      const { value, modelType } = confidenceScore;
      let confidenceColor = "text-yellow-500";
      let modelBadge = null;
      
      // Xác định loại model badge
      if (modelType === 'ONNX') {
        modelBadge = (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            ONNX
          </span>
        );
      } else if (modelType === 'Simulated') {
        modelBadge = (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            Giả lập
          </span>
        );
      } else {
        modelBadge = (
          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Chuẩn
          </span>
        );
      }
      
      // Xác định màu sắc dựa trên độ tin cậy
      if (value > 0.9) confidenceColor = "text-green-500";
      else if (value > 0.7) confidenceColor = "text-yellow-500";
      else confidenceColor = "text-red-500";
      
      return (
        <div className="confidence-info flex items-center gap-2 text-xs mb-2">
          <span>Độ tin cậy: <span className={confidenceColor}>
            {(value * 100).toFixed(1)}%
          </span></span>
          {modelBadge}
        </div>
      );
    }
    
    // Chế độ tương thích cũ (chỉ hiển thị độ tin cậy)
    const confidence = typeof confidenceScore === 'number' ? confidenceScore : 0;
    let confidenceColor = "text-yellow-500";
    if (confidence > 0.9) confidenceColor = "text-green-500";
    else if (confidence > 0.7) confidenceColor = "text-yellow-500";
    else confidenceColor = "text-red-500";
    
    return (
      <div className="confidence-info text-xs mb-2">
        Độ tin cậy: <span className={confidenceColor}>
          {(confidence * 100).toFixed(1)}%
        </span>
      </div>
    );
  };

  return (
    <div className="translation-panel">
      {/* Thêm dòng hiển thị thời gian để xác nhận cập nhật */}
      <div style={{ fontSize: '10px', color: '#999', position: 'absolute', top: '5px', right: '10px' }}>
        Cập nhật: {new Date(panelState.lastUpdateTime).toLocaleTimeString()} ({panelState.forceUpdateCounter})
      </div>
      
      <div className="panel-header">
        <h2>Nhận diện và dịch văn bản</h2>
        <div className="status-indicators">
          {microphoneActive && (
            <div className="mic-status">
              <div className="mic-level" style={{ 
                width: `${microphoneLevel}%`,
                backgroundColor: isSpeaking ? '#ff5252' : '#4caf50'
              }}></div>
            </div>
          )}
          <div className="recognition-status">
            <span className={`status-indicator ${isRecognizing ? 'active' : 'inactive'}`}>
              {isRecognizing ? 'Đang nhận diện' : 'Đã dừng'}
            </span>
            {isSpeaking && (
              <span className="speaking-indicator">Đang nói (Đỉnh: {peakLevel.toFixed(0)}%)</span>
            )}
          </div>
        </div>
        <div className="controls">
          <button 
            className={`control-btn ${isRecognizing ? 'stop' : 'start'}`}
            onClick={() => {
              console.log('CLICK TRỰC TIẾP: ' + (isRecognizing ? 'dừng' : 'bắt đầu'));
              if (isRecognizing) {
                stopRecognition();
              } else {
                startRecognition();
              }
              // Force cập nhật UI sau khi thực hiện hành động
              setTimeout(forceUIUpdate, 100);
              setTimeout(forceUIUpdate, 500);
            }}
          >
            {isRecognizing ? 'Dừng' : 'Bắt đầu'}
          </button>
          {!isRealTimeTranslate && (
            <button 
              className="control-btn translate"
              onClick={handleTranslate}
              disabled={!recognizedText}
            >
              Dịch
            </button>
          )}
          <button
            className={`control-btn ${useMockData ? 'mock-on' : 'mock-off'}`}
            onClick={toggleMockData}
          >
            {useMockData ? 'Đang dùng dữ liệu giả lập' : 'Đang dùng microphone thật'}
          </button>
          
          <button
            className={`control-btn ${showAdvancedFeatures ? 'feature-on' : 'feature-off'}`}
            onClick={toggleAdvancedFeatures}
          >
            {showAdvancedFeatures ? 'Ẩn tính năng nâng cao' : 'Hiện tính năng nâng cao'}
          </button>
        </div>
      </div>

      {/* Advanced Features Section */}
      {showAdvancedFeatures && (
        <div className="advanced-features">
          <ContextUploader />
          <SpeakerSelector 
            onSpeakerChange={handleSpeakerChange}
            onVoiceReferenceChange={handleVoiceReferenceChange}
          />
        </div>
      )}

        <div className="server-status-alert">
          <div className="alert-message">
            <strong>ℹ️ Thông báo:</strong> Server đã được cấu hình để sử dụng mô hình ONNX cho nhận diện giọng nói.
            Hệ thống sẽ tự động chuyển sang chế độ mô phỏng nếu không tìm thấy mô hình.
          </div>
          <button
            className="control-btn mock-on"
            onClick={() => {
              // Kiểm tra kết nối socket
              checkSocketConnection();
            }}
          >
            Kiểm tra kết nối
          </button>
          <button
            className="control-btn translate"
            onClick={() => {
              // Cấu hình lại socket
              reconfigureSocket();
            }}
          >
            Cấu hình lại Socket
          </button>
        </div>
        
      <div className="translation-content">
        <div className="text-display">
          <h3>Văn bản nhận diện:</h3>
          {/* Hiển thị thông tin về độ tin cậy */}
          {renderConfidenceInfo()}
          <div className="text-content">
            {recognizedText || (
              <span className="placeholder">
                {isRecognizing 
                  ? "Đang lắng nghe... (hãy nói điều gì đó)" 
                  : "Nhấn nút Bắt đầu để nhận diện giọng nói"}
              </span>
            )}
          </div>
        </div>
        
        <div className="text-display">
          <h3>Văn bản đã dịch:</h3>
          <div className="text-content">
            {translatedText || (
              <span className="placeholder">
                {isRealTimeTranslate 
                  ? "Văn bản dịch sẽ tự động hiển thị" 
                  : "Nhấn nút Dịch để dịch văn bản nhận diện"}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Debug Panel */}
      <div className="debug-panel">
        <button
          onClick={() => setShowDebug(!showDebug)}
          className="debug-toggle"
        >
          {showDebug ? 'Ẩn debug' : 'Hiện debug'}
        </button>
        
        {showDebug && (
          <div className="debug-info">
            <div className="debug-controls">
              <button 
                className="debug-btn check-socket"
                onClick={() => {
                  checkSocketConnection();
                }}
              >
                Kiểm tra Socket
              </button>
              <button 
                className="debug-btn reconfigure-socket"
                onClick={() => {
                  reconfigureSocket();
                }}
              >
                Khởi động lại Socket
              </button>
              <button
                className="debug-btn reset-state"
                onClick={() => {
                  setRecognizedText('');
                  setTranslatedText('');
                }}
              >
                Reset State
              </button>
              <button
                className="debug-btn emergency-start"
                onClick={() => {
                  startRecognition();
                  setTimeout(forceUIUpdate, 100);
                }}
              >
                Force Start
              </button>
              <button
                className="debug-btn test-recognition"
                onClick={() => {
                  // Simulate transcription result
                  const mockResult = {
                    text: "Đây là văn bản giả lập.",
                    language: sourceLanguage,
                    confidence: 0.95,
                    inferenceTime: 0.5
                  };
                  onTranscriptionResult(mockResult);
                }}
              >
                Test Recognition
              </button>
            </div>
            
            <div className="debug-status">
              <p>Source: <strong>{sourceLanguage}</strong></p>
              <p>Target: <strong>{targetLanguage}</strong></p>
              <p>Recognition: <strong>{isRecognizing ? 'Active' : 'Inactive'}</strong></p>
              <p>Socket: <strong>{socket?.connected ? 'Connected' : 'Disconnected'}</strong></p>
              <p>Mic Level: <strong>{microphoneLevel.toFixed(1)}%</strong></p>
              <p>Real-time: <strong>{isRealTimeTranslate ? 'On' : 'Off'}</strong></p>
              <p>Mock data: <strong>{useMockData ? 'On' : 'Off'}</strong></p>
            </div>
            
            <div className="debug-log">
              {debugInfo}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TranslationPanel;
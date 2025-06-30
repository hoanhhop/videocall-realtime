import React, { useState, useRef, useEffect } from 'react';
import './SpeakerSelector.css';

const SpeakerSelector = ({ onSpeakerChange, onVoiceReferenceChange }) => {
  const [selectedSpeaker, setSelectedSpeaker] = useState('');
  const [speakers, setSpeakers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [enableVoiceCloning, setEnableVoiceCloning] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);
  
  // Fetch available speakers on component mount
  useEffect(() => {
    fetchSpeakers();
  }, []);
  
  // Handle recording timer
  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime(prevTime => prevTime + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    
    return () => clearInterval(timerRef.current);
  }, [isRecording]);
  
  // Fetch speakers list from server
  const fetchSpeakers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/tts/speakers');
      
      if (!response.ok) {
        throw new Error('Failed to fetch speakers');
      }
      
      const data = await response.json();
      setSpeakers(data.speakers || []);
    } catch (error) {
      console.error('Error fetching speakers:', error);
      setErrorMessage('Không thể lấy danh sách giọng nói');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Handle speaker selection
  const handleSpeakerChange = (e) => {
    const speaker = e.target.value;
    setSelectedSpeaker(speaker);
    onSpeakerChange(speaker);
    // When selecting a predefined speaker, clear any recorded voice
    setRecordedBlob(null);
    onVoiceReferenceChange(null);
  };
  
  // Toggle voice cloning feature
  const handleToggleVoiceCloning = () => {
    setEnableVoiceCloning(!enableVoiceCloning);
    if (enableVoiceCloning) {
      // Clean up when disabling
      stopRecording();
      setRecordedBlob(null);
      onVoiceReferenceChange(null);
    }
  };
  
  // Start voice recording
  const startRecording = async () => {
    try {
      setErrorMessage('');
      audioChunksRef.current = [];
      setRecordingTime(0);
      
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        setRecordedBlob(audioBlob);
        onVoiceReferenceChange(audioBlob);
        
        if (audioRef.current) {
          audioRef.current.src = URL.createObjectURL(audioBlob);
        }
        
        // Clear the selected speaker when using recorded voice
        setSelectedSpeaker('');
        onSpeakerChange('');
      };
      
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      setErrorMessage('Không thể truy cập microphone. Vui lòng kiểm tra quyền truy cập.');
    }
  };
  
  // Stop voice recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
    }
  };
  
  // Handle file upload for voice reference
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check if it's an audio file
    if (!file.type.startsWith('audio/')) {
      setErrorMessage('Vui lòng tải lên file âm thanh hợp lệ (WAV, MP3)');
      return;
    }
    
    // Read the file
    const reader = new FileReader();
    reader.onload = () => {
      const blob = new Blob([reader.result], { type: file.type });
      setRecordedBlob(blob);
      onVoiceReferenceChange(blob);
      
      if (audioRef.current) {
        audioRef.current.src = URL.createObjectURL(blob);
      }
      
      // Clear the selected speaker when using uploaded voice
      setSelectedSpeaker('');
      onSpeakerChange('');
    };
    reader.readAsArrayBuffer(file);
  };
  
  // Format recording time as mm:ss
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  if (!enableVoiceCloning) {
    return (
      <div className="speaker-selector disabled">
        <div className="speaker-header">
          <h3>Tùy chỉnh giọng nói / Voice customization</h3>
          <label className="toggle-switch">
            <input 
              type="checkbox" 
              checked={enableVoiceCloning}
              onChange={handleToggleVoiceCloning}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        <div className="speaker-inactive">
          <p>Tính năng tùy chỉnh giọng nói đang tắt</p>
        </div>
      </div>
    );
  }

  return (
    <div className="speaker-selector">
      <div className="speaker-header">
        <h3>Tùy chỉnh giọng nói / Voice customization</h3>
        <label className="toggle-switch">
          <input 
            type="checkbox" 
            checked={enableVoiceCloning}
            onChange={handleToggleVoiceCloning}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>
      
      {errorMessage && (
        <div className="error-message">
          {errorMessage}
        </div>
      )}
      
      <div className="speaker-options">
        <div className="predefined-speakers">
          <label>Chọn giọng có sẵn:</label>
          <select 
            value={selectedSpeaker} 
            onChange={handleSpeakerChange}
            disabled={isLoading || isRecording || recordedBlob !== null}
          >
            <option value="">-- Chọn giọng --</option>
            {speakers.map(speaker => (
              <option key={speaker} value={speaker}>
                {speaker}
              </option>
            ))}
          </select>
          {isLoading && <span className="loading-indicator">Đang tải...</span>}
        </div>
        
        <div className="voice-cloning-section">
          <h4>Hoặc sử dụng giọng của riêng bạn:</h4>
          
          <div className="cloning-controls">
            {!isRecording && !recordedBlob ? (
              <button 
                className="record-button start" 
                onClick={startRecording}
                disabled={isLoading}
              >
                Bắt đầu ghi âm
              </button>
            ) : isRecording ? (
              <div className="recording-status">
                <span className="recording-indicator">● Đang ghi âm: {formatTime(recordingTime)}</span>
                <button className="record-button stop" onClick={stopRecording}>
                  Dừng ghi âm
                </button>
              </div>
            ) : (
              <div className="recorded-status">
                <span className="recorded-indicator">✓ Đã ghi âm ({formatTime(recordingTime)})</span>
                <button className="record-button clear" onClick={() => {
                  setRecordedBlob(null);
                  onVoiceReferenceChange(null);
                }}>
                  Xóa
                </button>
                <button className="record-button record-again" onClick={startRecording}>
                  Ghi lại
                </button>
              </div>
            )}
          </div>
          
          {recordedBlob && (
            <div className="preview-section">
              <audio ref={audioRef} controls className="audio-preview" />
            </div>
          )}
          
          <div className="upload-section">
            <p>Hoặc tải lên file âm thanh:</p>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="audio/*"
              className="file-input"
            />
            <button 
              className="upload-button"
              onClick={() => fileInputRef.current.click()}
              disabled={isRecording}
            >
              Tải lên file âm thanh
            </button>
          </div>
        </div>
      </div>
      
      <div className="voice-status">
        {selectedSpeaker ? (
          <div className="active-status">
            ✓ Đang sử dụng giọng: <strong>{selectedSpeaker}</strong>
          </div>
        ) : recordedBlob ? (
          <div className="active-status">
            ✓ Đang sử dụng giọng đã ghi âm
          </div>
        ) : (
          <div className="inactive-status">
            Chưa chọn giọng nói
          </div>
        )}
      </div>
    </div>
  );
};

export default SpeakerSelector; 
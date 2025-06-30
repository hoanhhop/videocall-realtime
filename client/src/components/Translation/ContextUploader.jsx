import React, { useRef, useState } from 'react';
import { useTranslation } from '../../contexts/TranslationContext';
import './ContextUploader.css';

const ContextUploader = () => {
  const { setContext, contextFile, clearContext } = useTranslation();
  const [contextFileName, setContextFileName] = useState('');
  const [directText, setDirectText] = useState('');
  const [enableContext, setEnableContext] = useState(true);
  const [showTextInput, setShowTextInput] = useState(false);
  const fileInputRef = useRef(null);

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Check if it's a supported file type
    const validTypes = ['application/json', 'text/plain', 'application/msword', 
                       'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    const fileExtension = file.name.split('.').pop().toLowerCase();
    const validExtensions = ['json', 'txt', 'doc', 'docx'];
    
    if (!validTypes.includes(file.type) && !validExtensions.includes(fileExtension)) {
      alert('Vui lòng tải lên file hỗ trợ (.json, .txt, .doc, .docx).');
      return;
    }
    
    setContextFileName(file.name);
    setShowTextInput(false);
    setContext(file);
  };
  
  // Trigger file input click
  const handleUploadClick = () => {
    fileInputRef.current.click();
  };
  
  // Toggle context feature
  const handleToggleContext = () => {
    setEnableContext(!enableContext);
    if (enableContext) {
      // Disable context
      clearContext();
      setContextFileName('');
      setDirectText('');
    }
  };
  
  // Toggle text input
  const handleToggleTextInput = () => {
    setShowTextInput(!showTextInput);
    if (contextFileName) {
      setContextFileName('');
      clearContext();
    }
  };
  
  // Submit direct text as context
  const handleTextSubmit = () => {
    if (directText.trim()) {
      setContext(directText);
      setContextFileName('Văn bản trực tiếp');
    }
  };
  
  // Sample context file example
  const sampleContext = {
    glossary: [
      { source: 'API endpoint', target: 'API endpoint' },
      { source: 'machine learning', target: 'học máy' },
      { source: 'neural network', target: 'mạng nơ-ron' }
    ]
  };
  
  // Download sample context file
  const downloadSample = () => {
    const dataStr = JSON.stringify(sampleContext, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const downloadLink = document.createElement('a');
    downloadLink.setAttribute('href', dataUri);
    downloadLink.setAttribute('download', 'sample-context.json');
    downloadLink.click();
  };

  if (!enableContext) {
    return (
      <div className="context-uploader disabled">
        <div className="context-header">
          <h3>Bộ từ điển chuyên ngành / Domain glossary</h3>
          <label className="toggle-switch">
            <input 
              type="checkbox" 
              checked={enableContext}
              onChange={handleToggleContext}
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
        <div className="context-inactive">
          <p>Tính năng bộ từ điển chuyên ngành đang tắt</p>
        </div>
      </div>
    );
  }

  return (
    <div className="context-uploader">
      <div className="context-header">
      <h3>Bộ từ điển chuyên ngành / Domain glossary</h3>
        <label className="toggle-switch">
          <input 
            type="checkbox" 
            checked={enableContext}
            onChange={handleToggleContext}
          />
          <span className="toggle-slider"></span>
        </label>
      </div>
      
      <div className="upload-container">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept=".json,.txt,.doc,.docx,application/json,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="file-input"
        />
        
        <div className="button-group">
        <button 
          className="upload-button"
          onClick={handleUploadClick}
        >
          {contextFile ? 'Thay đổi file / Change file' : 'Tải lên file / Upload file'}
        </button>
        
          <button 
            className={`text-input-button ${showTextInput ? 'active' : ''}`}
            onClick={handleToggleTextInput}
          >
            {showTextInput ? 'Đóng nhập văn bản' : 'Nhập văn bản trực tiếp'}
          </button>
        
        <button 
          className="sample-button"
          onClick={downloadSample}
        >
          Tải mẫu / Download sample
        </button>
      </div>
        
        {contextFileName && (
          <div className="file-name">
            <span>File hiện tại:</span> {contextFileName}
            <button 
              className="clear-button"
              onClick={() => {
                clearContext();
                setContextFileName('');
              }}
            >
              ✕
            </button>
          </div>
        )}
      </div>
      
      {showTextInput && (
        <div className="text-input-container">
          <textarea
            value={directText}
            onChange={(e) => setDirectText(e.target.value)}
            placeholder="Nhập văn bản mô tả chuyên ngành, từ điển hoặc ngữ cảnh dịch thuật..."
            rows={5}
          />
          <button 
            className="submit-text-button"
            onClick={handleTextSubmit}
            disabled={!directText.trim()}
          >
            Sử dụng văn bản này
          </button>
        </div>
      )}
      
      <div className="context-info">
        {contextFile ? (
          <div className="context-active">
            ✓ Đang sử dụng bộ từ điển chuyên ngành
            <br />
            ✓ Using domain glossary
          </div>
        ) : (
          <div className="context-inactive">
            <p>
              Tải lên file hoặc nhập văn bản mô tả chuyên ngành để cải thiện chất lượng dịch
              <br />
              Upload a file or enter domain description to improve translation quality
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContextUploader;
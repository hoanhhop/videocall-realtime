import React, { useState } from 'react';
import { useTranslation } from '../../contexts/TranslationContext';
import './ContextInput.css';

const ContextInput = () => {
  const { setContextText, contextText, sourceLanguage } = useTranslation();
  const [inputText, setInputText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Examples for different languages
  const examples = {
    vi: 'Thảo luận về báo cáo tài chính của năm 2024 cho công ty Bình Minh',
    en: 'Discussion of the 2024 financial report for Binh Minh company'
  };

  // Handle input change
  const handleChange = (e) => {
    setInputText(e.target.value);
  };
  
  // Submit context text
  const handleSubmit = () => {
    if (inputText.trim()) {
      setContextText(inputText);
      setIsExpanded(false);
    }
  };
  
  // Use example
  const useExample = () => {
    const example = examples[sourceLanguage] || examples.vi;
    setInputText(example);
  };
  
  // Clear context
  const clearContext = () => {
    setContextText('');
    setInputText('');
  };

  return (
    <div className="context-input">
      <div className="context-input-header" onClick={() => setIsExpanded(!isExpanded)}>
        <h3>Ngữ cảnh văn bản / Text context</h3>
        <span className={`toggle-icon ${isExpanded ? 'expanded' : ''}`}>
          {isExpanded ? '▲' : '▼'}
        </span>
      </div>
      
      {isExpanded && (
        <div className="context-input-content">
          <textarea
            placeholder={`Nhập ngữ cảnh cho cuộc hội thoại, ví dụ: ${examples[sourceLanguage] || examples.vi}\nEnter conversation context, e.g.: ${examples.en}`}
            value={inputText}
            onChange={handleChange}
            rows={4}
          />
          
          <div className="context-input-actions">
            <button 
              className="example-button"
              onClick={useExample}
            >
              Dùng ví dụ / Use example
            </button>
            
            <button 
              className="submit-button"
              onClick={handleSubmit}
              disabled={!inputText.trim()}
            >
              Áp dụng / Apply
            </button>
            
            <button 
              className="clear-button"
              onClick={clearContext}
              disabled={!contextText}
            >
              Xóa / Clear
            </button>
          </div>
        </div>
      )}
      
      {contextText && !isExpanded && (
        <div className="active-context">
          <p className="context-preview">
            <span className="context-label">Đang sử dụng ngữ cảnh / Using context:</span> 
            {contextText.length > 50 ? `${contextText.substring(0, 50)}...` : contextText}
          </p>
          <button 
            className="edit-context-button"
            onClick={() => setIsExpanded(true)}
          >
            Chỉnh sửa / Edit
          </button>
        </div>
      )}
    </div>
  );
};

export default ContextInput;
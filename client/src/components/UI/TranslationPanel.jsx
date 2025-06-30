import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../contexts/TranslationContext';

const TranslationPanel = ({ className = '', showControls = true, translationOnly = false, ...props }) => {
  const {
    recognizedText,
    translatedText,
    sourceLanguage,
    targetLanguage,
    isRealTimeTranslate,
    toggleRealTimeTranslate,
    translateManually,
  } = useTranslation();

  // Thêm trạng thái local để đảm bảo hiển thị
  const [localTranslatedText, setLocalTranslatedText] = useState('');
  
  // Cập nhật localTranslatedText khi translatedText thay đổi
  useEffect(() => {
    if (translatedText && translatedText.trim()) {
      setLocalTranslatedText(translatedText);
    }
  }, [translatedText]);

  // Hàm translate với thêm kỹ thuật tối ưu UX
  const handleTranslate = () => {
    // Hiệu ứng "đang dịch..." trước khi có kết quả
    if (recognizedText && recognizedText.trim()) {
      setLocalTranslatedText('Đang dịch...');
      translateManually();
    }
  };

  return (
    <div className={`translation-panel ${className}`} {...props}>
      {!translationOnly && (
        <div className="panel-input">
          <h3>{sourceLanguage === 'en' ? 'English' : 'Tiếng Việt'}</h3>
          <div className="recognized-text">
            {recognizedText || 'Speech will be recognized here...'}
          </div>
        </div>
      )}

      <div className="panel-output">
        <h3>{targetLanguage === 'en' ? 'English' : 'Tiếng Việt'}</h3>
        <div className="translated-text">
          {localTranslatedText || translatedText || 'Bản dịch sẽ hiển thị ở đây...'}
        </div>
      </div>

      {showControls && (
        <div className="translation-controls">
          <button
            className={`toggle-button ${isRealTimeTranslate ? 'active' : ''}`}
            onClick={toggleRealTimeTranslate}
          >
            {isRealTimeTranslate ? 'Dịch tự động: BẬT' : 'Dịch tự động: TẮT'}
          </button>
          {!isRealTimeTranslate && (
            <button className="translate-button" onClick={handleTranslate}>
              Dịch ngay
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TranslationPanel; 
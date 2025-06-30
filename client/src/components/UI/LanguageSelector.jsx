import React from 'react';
import { useTranslation } from '../../contexts/TranslationContext';
import './LanguageSelector.css';

const LanguageSelector = () => {
  const {
    sourceLanguage,
    targetLanguage,
    setSourceLanguage,
    setTargetLanguage,
    swapLanguages
  } = useTranslation();
  
  // Handle source language change
  const handleSourceChange = (e) => {
    const newSourceLang = e.target.value;
    setSourceLanguage(newSourceLang);
    
    // If source and target would be the same, swap them
    if (newSourceLang === targetLanguage) {
      setTargetLanguage(sourceLanguage);
    }
  };
  
  // Handle target language change
  const handleTargetChange = (e) => {
    const newTargetLang = e.target.value;
    setTargetLanguage(newTargetLang);
    
    // If source and target would be the same, swap them
    if (newTargetLang === sourceLanguage) {
      setSourceLanguage(targetLanguage);
    }
  };

  return (
    <div className="language-selector">
      <div className="language-option">
        <label htmlFor="source-language">Ngôn ngữ nói / Speak:</label>
        <select
          id="source-language"
          value={sourceLanguage}
          onChange={handleSourceChange}
        >
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </select>
      </div>
      
      <button 
        className="swap-button"
        onClick={swapLanguages}
        aria-label="Swap languages"
      >
        ⇄
      </button>
      
      <div className="language-option">
        <label htmlFor="target-language">Ngôn ngữ dịch / Translate to:</label>
        <select
          id="target-language"
          value={targetLanguage}
          onChange={handleTargetChange}
        >
          <option value="vi">Tiếng Việt</option>
          <option value="en">English</option>
        </select>
      </div>
    </div>
  );
};

export default LanguageSelector;